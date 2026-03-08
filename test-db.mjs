import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

async function run() {
    console.log("Checking DB...")
    const { data, error } = await supabase.from('daily_fopo').select('*').limit(5)
    console.log(data, error)
}
run()
