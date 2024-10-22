# Lintai

```json
{
    "languageserver": {
        "ailinter": {
            "enable": true,
            "command": "deno",
            "args": [
                "run",
                "--allow-all",
                "<PATH>/lintai/src/index.ts",
                "--",
                "--stdio",
            ],
            "filetypes": [
                "javascript",
                "typescript",
            ],
            "rootPatterns": [
                ".git/",
                "package.json",
                "tsconfig.json",
                "deno.lock"
            ],
            "initializationOptions": {
                "apiKey": "<API-KEY>"
            }
        },
    }
}
```
