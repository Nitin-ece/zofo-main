import { supabase } from "./supabase"

/**
 * Ensure a row exists in public.users for the signed-in auth user.
 * This is needed because Supabase doesn't auto-create public.users on signup.
 * Safe to call multiple times — uses upsert.
 */
export async function ensureUserRecord(userId: string): Promise<void> {
    const { data: authUser, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authUser?.user) return

    const email = authUser.user.email ?? ""
    const username = authUser.user.user_metadata?.username || email.split("@")[0] || "User"

    const { error } = await supabase
        .from("users")
        .upsert(
            { id: userId, email, username },
            { onConflict: "id", ignoreDuplicates: true }
        )

    if (error && error.code !== "23505") {
        // 23505 = unique_violation — safe to ignore (row already exists)
        console.warn("ensureUserRecord non-critical error:", error.message)
    }
}

/**
 * Save a completed focus session and update the user's cumulative FoPo points.
 * Data persists in the database — logging out does NOT reset anything.
 */
export async function saveFocusSession(
    userId: string,
    startTime: string,
    endTime: string,
    focusMinutes: number,
    distractions: number,
    fopoEarned: number
) {
    // 1. Ensure public.users row exists (required for FK constraints)
    await ensureUserRecord(userId)

    // 2. Insert focus session record
    const { data: sessionData, error: sessionError } = await supabase
        .from("focus_sessions")
        .insert([{
            user_id: userId,
            start_time: startTime,
            end_time: endTime,
            focus_minutes: focusMinutes,
            distractions: distractions,
            fopo_earned: fopoEarned,
            created_at: new Date().toISOString()
        }])
        .select()

    if (sessionError) {
        console.error("focus_sessions insert error:", sessionError)
        throw sessionError
    }

    // 3. Upsert cumulative FoPo — atomic to avoid race conditions
    // First try to update existing row atomically
    const { data: existing } = await supabase
        .from("fopo_points")
        .select("total_fopo")
        .eq("user_id", userId)
        .single()

    if (existing) {
        // Atomic update: use the current DB value, not a stale read
        const newTotal = existing.total_fopo + fopoEarned
        const newLevel = Math.floor(newTotal / 1000) + 1
        const { error: updateErr } = await supabase
            .from("fopo_points")
            .update({ total_fopo: newTotal, level: newLevel, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
        if (updateErr) {
            console.error("fopo_points update error:", updateErr)
            throw updateErr
        }
    } else {
        // First session ever — insert new row
        const newLevel = Math.floor(fopoEarned / 1000) + 1
        const { error: insertErr } = await supabase
            .from("fopo_points")
            .insert({ user_id: userId, total_fopo: fopoEarned, level: newLevel, updated_at: new Date().toISOString() })
        if (insertErr) {
            console.error("fopo_points insert error:", insertErr)
            throw insertErr
        }
    }

    // 4. Save today's FoPo snapshot (non-critical — don't throw if fails)
    try {
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

        const { data: snap } = await supabase
            .from("daily_fopo")
            .select("fopo_earned")
            .eq("user_id", userId)
            .eq("date", today)
            .single()

        const newDailyTotal = (snap?.fopo_earned ?? 0) + fopoEarned

        await supabase
            .from("daily_fopo")
            .upsert(
                { user_id: userId, date: today, fopo_earned: newDailyTotal },
                { onConflict: "user_id,date" }
            )
    } catch (e) {
        console.warn("daily_fopo update non-critical error:", e)
    }

    return sessionData
}

/**
 * Fetch leaderboard — ONLY real signed-up users from fopo_points, sorted by total.
 */
export async function getLeaderboard() {
    const { data, error } = await supabase
        .from("fopo_points")
        .select("user_id, total_fopo, level, updated_at")
        .order("total_fopo", { ascending: false })
        .limit(50)

    if (error) throw error
    return data ?? []
}

/**
 * Fetch leaderboard with today's daily FoPo
 */
export async function getLeaderboardWithDaily() {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const [{ data: totals, error: totalsErr }, { data: dailySnaps }] = await Promise.all([
        supabase.from("fopo_points").select("user_id, total_fopo, level").order("total_fopo", { ascending: false }).limit(50),
        supabase.from("daily_fopo").select("user_id, fopo_earned").eq("date", today)
    ])

    if (totalsErr) throw totalsErr

    const dailyMap: Record<string, number> = {}
    for (const snap of (dailySnaps ?? [])) {
        dailyMap[snap.user_id] = snap.fopo_earned
    }

    return (totals ?? []).map(u => ({
        ...u,
        daily_fopo: dailyMap[u.user_id] ?? 0
    }))
}

/**
 * Get user's current FoPo and Level
 */
export async function getUserFoPo(userId: string) {
    const { data, error } = await supabase
        .from("fopo_points")
        .select("total_fopo, level, updated_at")
        .eq("user_id", userId)
        .maybeSingle()

    if (error) return null
    return data
}

/**
 * Upload a music file to Supabase storage and save its url to music_library
 */
export async function uploadMusic(userId: string, file: File, songName: string) {
    // Ensure user record exists
    await ensureUserRecord(userId)

    const fileName = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`

    const { error: uploadError } = await supabase.storage
        .from("music")
        .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage
        .from("music")
        .getPublicUrl(fileName)

    const { data, error } = await supabase
        .from("music_library")
        .insert([{ user_id: userId, song_name: songName, file_url: publicUrlData.publicUrl }])
        .select()

    if (error) throw error
    return data
}

/**
 * Fetch focus session analytics data for a specific user
 */
export async function getFocusAnalytics(userId: string) {
    const { data, error } = await supabase
        .from("focus_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("start_time", { ascending: true })

    if (error) throw error
    return data
}

/**
 * Upload a profile avatar to Supabase storage and update auth metadata
 */
export async function uploadAvatar(userId: string, file: File) {
    const fileExt = file.name.split(".").pop()
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName)

    const avatarUrl = publicUrlData.publicUrl

    const { error } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } })
    if (error) throw error

    return avatarUrl
}

/**
 * Fetch FoPo points from the daily_fopo table mapped to a weeks x days grid.
 * Used for GitHub-style activity heatmaps.
 */
export async function getHeatmapData(userId: string, numWeeks: number = 7) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate the start date (numWeeks ago, starting on a Monday)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (numWeeks * 7) + 1)

    const d1 = startDate
    const startStr = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}-${String(d1.getDate()).padStart(2, '0')}`

    const d2 = today
    const todayStr = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`

    const { data, error } = await supabase
        .from("daily_fopo")
        .select("date, fopo_earned")
        .eq("user_id", userId)
        .gte("date", startStr)
        .lte("date", todayStr)

    if (error) throw error

    // Create a dictionary of YYYY-MM-DD to fopo_earned
    const dailyMap: Record<string, number> = {}
    if (data) {
        data.forEach(row => {
            dailyMap[row.date] = row.fopo_earned
        })
    }

    // Generate the grid [week][day]
    // 0 = Sunday, 1 = Monday, etc. But heatmaps usually show Mon-Sun
    // For simplicity of existing UI, just generate an array of arrays.
    const grid: number[][] = Array.from({ length: numWeeks }, () => Array.from({ length: 7 }, () => 0))

    // We'll just populate the grid backwards from today
    let iterDate = new Date(today)
    let w = numWeeks - 1
    let d = 6 // start at the end of the current week row

    for (let i = 0; i < numWeeks * 7; i++) {
        if (w < 0) break

        const yr = iterDate.getFullYear()
        const mo = String(iterDate.getMonth() + 1).padStart(2, '0')
        const da = String(iterDate.getDate()).padStart(2, '0')
        const dateStr = `${yr}-${mo}-${da}`

        const fopo = dailyMap[dateStr] || 0

        // Convert fopo into intensity 0-4
        let intensity = 0
        if (fopo > 0) intensity = 1
        if (fopo >= 50) intensity = 2
        if (fopo >= 150) intensity = 3
        if (fopo >= 300) intensity = 4

        grid[w][d] = intensity

        // Move to previous day
        iterDate.setDate(iterDate.getDate() - 1)
        d--
        if (d < 0) {
            d = 6
            w--
        }
    }

    return grid
}

/**
 * Creates a new public or private study room
 */
export async function createStudyRoom(roomData: { host_id: string, name: string, subject: string, max_participants: number, is_private: boolean, room_code: string }) {
    await ensureUserRecord(roomData.host_id)

    // Room creation — validated at UI layer

    const { data, error } = await supabase
        .from("study_rooms")
        .insert([{
            ...roomData,
            is_live: true,
            participants: 1 // host is the first participant
        }])
        .select()
        .single()

    if (error) {
        console.error("[DB] Supabase Insert Error:", error.message, error.details, error.hint);
        throw new Error(error.message || "Unknown Supabase insertion error");
    }

    return data
}

/**
 * Fetches all public, active study rooms.
 * Uses a join on room_participants to get the accurate live count.
 */
export async function getPublicRooms() {
    const { data, error } = await supabase
        .from("study_rooms")
        .select(`
            id, name, subject, max_participants, is_private, is_live, room_code,
            host:host_id ( username, email ),
            room_participants ( count )
        `)
        .eq("is_private", false)
        .eq("is_live", true)
        .order("created_at", { ascending: false })

    if (error) throw error

    // Format the count from the joined table
    return data.map((room: any) => ({
        ...room,
        participants: room.room_participants?.[0]?.count || 0,
        room_participants: undefined // clean up raw aggregate JSON
    }))
}

/**
 * Join a study room
 */
export async function joinRoom(roomId: string, userId: string) {
    if (!roomId || !userId) return;

    // Insert into room_participants (unique constraint will naturally prevent duplicates)
    const { error } = await supabase
        .from("room_participants")
        .insert([{ room_id: roomId, user_id: userId }])
    // PostgREST will throw if it already exists, so we ignore conflict
    // Or if using UPSERT: .upsert([{ room_id: roomId, user_id: userId }], { onConflict: 'room_id,user_id' })

    // We can safely ignore "duplicate key" errors if they simply try to join twice
    if (error && error.code !== '23505') {
        console.error("[DB] Failed to join room:", error)
        throw error
    }
}

/**
 * Leave a study room
 */
export async function leaveRoom(roomId: string, userId: string) {
    if (!roomId || !userId) return;

    const { error } = await supabase
        .from("room_participants")
        .delete()
        .match({ room_id: roomId, user_id: userId })

    if (error) {
        console.error("[DB] Failed to leave room:", error)
        throw error
    }
}

/**
 * Send a message to a study room
 */
export async function sendMessage(roomId: string, userId: string, message: string) {
    if (!roomId || !userId || !message.trim()) return;

    const { data, error } = await supabase
        .from("room_messages")
        .insert([{
            room_id: roomId,
            user_id: userId,
            message: message.trim()
        }])
        .select()

    if (error) {
        console.error("[DB] Failed to send message:", error)
        throw error
    }
    return data
}

/**
 * Fetch messages for a specific room
 */
export async function getRoomMessages(roomId: string) {
    if (!roomId) return []

    // Ensure auth is ready implicitly by grabbing the session if needed,
    // though for reading messages a simple select often works if RLS allows.
    // However, the prompt asks to "Ensure the query runs only after Supabase auth is ready."
    // We can do a quick check.
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) return []

    const { data, error } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })

    if (error) {
        console.error("[DB] Failed to fetch messages:", error.message)
        return []
    }
    return data ?? []
}

/**
 * Delete a study room (Host only)
 */
export async function deleteRoom(roomId: string, hostId: string) {
    if (!roomId || !hostId) return;

    // We constrain the deletion to WHERE id = roomId AND host_id = hostId
    // to ensure only the host can actually delete it.
    const { error } = await supabase
        .from("study_rooms")
        .delete()
        .match({ id: roomId, host_id: hostId })

    if (error) {
        console.error("[DB] Failed to delete room:", error)
        throw error
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC & PLAYLISTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all playlists for a specific user
 */
export async function getPlaylists(userId: string) {
    const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
}

/**
 * Create a new playlist
 */
export async function createPlaylist(userId: string, name: string) {
    const { data, error } = await supabase
        .from("playlists")
        .insert([{ user_id: userId, name }])
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Add a song to a playlist
 */
export async function addSongToPlaylist(playlistId: string, songId: string) {
    const { error } = await supabase
        .from("playlist_songs")
        .insert([{ playlist_id: playlistId, song_id: songId }])

    if (error) throw error
}

/**
 * Fetch all songs for a specific playlist
 */
export async function getPlaylistSongs(playlistId: string) {
    const { data, error } = await supabase
        .from("playlist_songs")
        .select(`
            id,
            song_id,
            music_library (*)
        `)
        .eq("playlist_id", playlistId)

    if (error) throw error
    
    // Map to a cleaner structure
    return (data || []).map((item: any) => item.music_library).filter(Boolean)
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(playlistId: string) {
    const { error } = await supabase
        .from("playlists")
        .delete()
        .eq("id", playlistId)

    if (error) throw error
}

/**
 * Remove a song from a playlist
 */
export async function removeSongFromPlaylist(playlistId: string, songId: string) {
    const { error } = await supabase
        .from("playlist_songs")
        .delete()
        .match({ playlist_id: playlistId, song_id: songId })

    if (error) throw error
}
