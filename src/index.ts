import {
    createConnection,
    DiagnosticSeverity,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from "npm:vscode-languageserver";
import { TextDocument } from "npm:vscode-languageserver-textdocument";
import axios from "npm:axios";

let apiKey: string;

let lastAnalysisTime = 0;
const analysisCooldown = 10 * 1000;

// @ts-ignore Eu que sei.
const connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params) => {
    const initializationOptions = params.initializationOptions;
    console.log("Initial configuration:", initializationOptions);

    apiKey = initializationOptions.apiKey;

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
        },
    };
});

const documents = new TextDocuments(TextDocument);

documents.onDidChangeContent(async (change) => {
    const currentTime = Date.now();
    if (currentTime - lastAnalysisTime < analysisCooldown) {
        console.log("Skipping AI analysis to avoid frequent requests.");

        return;
    }

    lastAnalysisTime = currentTime;

    const document = change.document;
    const text = document.getText();

    const lines = text.split("\n");

    const result = lines.map((line, index) => ({
        line: index,
        content: `${line}`,
    }));

    console.log(result);

    // TODO: Instead of send all the lines to the API, we could send fixed side pieces to a better evaluation.
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
            {
                systemInstruction: {
                    role: "user",
                    parts: [
                        {
                            text:
                                "Treat each JSON input as a multi-line parsed code, analyzing it looking for security flaws. Returning an LSP diagnostics compatible array, with all object properties.",
                        },
                    ],
                },
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: JSON.stringify(result),
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 1,
                    topK: 64,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );

        const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]
            ?.text;
        if (!resultText) {
            console.warn("invalid result text", resultText);
            console.warn(response.data.candidates);

            return;
        }

        const parsedResult = JSON.parse(resultText);
        const diagnostics = [];

        for (const key in parsedResult) {
            const diag = parsedResult[key];
            if (!diag) {
                continue;
            }

            diagnostics.push({
                severity: DiagnosticSeverity.Hint,
                range: {
                    start: {
                        line: diag.range.start.line,
                        character: diag.range.start.character,
                    },
                    end: {
                        line: diag.range.end.line,
                        character: diag.range.end.character,
                    },
                },
                message: diag.message,
                source: "Lintai",
            });
        }

        console.log("-----------------------");
        console.log(document.uri);
        console.log(diagnostics);
        console.log("-----------------------");

        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    } catch (err) {
        console.error(err);
    }
});

connection.listen();
documents.listen(connection);
