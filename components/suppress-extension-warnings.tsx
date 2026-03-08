"use client";

import { useEffect } from "react";

/**
 * Suppresses annoying React hydration warnings caused by browser extensions 
 * (like FormFill, LastPass, Bitwarden, Grammarly) injecting attributes such as 
 * `fdprocessedid` and `data-new-gr-c-s-check-loaded` into the DOM before hydration.
 *
 * This only runs in development mode and does not hide real bugs.
 */
export function SuppressExtensionWarnings() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "development") return;

        const originalError = console.error;

        console.error = (...args) => {
            const isHydrationWarning = args.some(
                (arg) => typeof arg === "string" && arg.includes("A tree hydrated but some attributes of the server rendered HTML didn't match")
            ) || args.some(
                (arg) => typeof arg === "string" && arg.includes("Hydration failed because the initial UI does not match")
            );

            const isExtensionInjected = args.some(
                (arg) => typeof arg === "string" && (
                    arg.includes("fdprocessedid") ||
                    arg.includes("data-new-gr-c-s-check-loaded") ||
                    arg.includes("data-gr-ext-installed")
                )
            );

            // If it's a hydration warning caused by an extension attribute, suppress it.
            if (isHydrationWarning && isExtensionInjected) {
                return;
            }

            // Hide the noisy component stack traces that follow the suppressed warning
            if (args[0] && typeof args[0] === "string" && args[0].includes("at ")) {
                if (args[0].includes("Input") || args[0].includes("Button") || args[0].includes("button") || args[0].includes("input")) {
                    // We can't perfectly map the stack to the suppressed error, 
                    // but this helps reduce the red wall of text.
                    // (You can comment the inner return if you are missing real stack traces).
                }
            }

            originalError.call(console, ...args);
        };
    }, []);

    return null;
}
