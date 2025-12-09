// Ace setup
const jsonEditor = ace.edit("jsonEditor");
jsonEditor.setTheme("ace/theme/chrome");
jsonEditor.session.setMode("ace/mode/json");

const csvEditor = ace.edit("csvEditor");
csvEditor.setTheme("ace/theme/chrome");
csvEditor.session.setMode("ace/mode/text");

// Resize Splitter
const splitter = document.getElementById("splitter");
splitter.addEventListener("mousedown", (e) => {
    document.body.style.cursor = "col-resize";

    const move = (e) => {
    const left = document.getElementById("jsonEditor").parentElement;
    const newWidth = e.clientX;
    left.style.width = newWidth + "px";
    };

    const stop = () => {
    document.body.style.cursor = "default";
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", stop);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
});

// CSV Converter Logic
document.getElementById("convertBtn").addEventListener("click", () => {
    try {
    const json = JSON.parse(jsonEditor.getValue());

    // Normalize to array
    const arr = Array.isArray(json) ? json : [json];

    const headers = Array.from(
        arr.reduce((set, obj) => {
        Object.keys(obj).forEach((k) => set.add(k));
        return set;
        }, new Set())
    );

    const csvRows = [];
    csvRows.push(headers.join(","));

    arr.forEach((obj) => {
        const row = headers.map((h) => JSON.stringify(obj[h] ?? "").replace(/^"|"$/g, ""));
        csvRows.push(row.join(","));
    });

    csvEditor.setValue(csvRows.join("\n"), -1);
    } catch (err) {
    alert("Invalid JSON");
    }
});

// Copy
document.getElementById("copyCsv").addEventListener("click", () => {
    navigator.clipboard.writeText(csvEditor.getValue());
    alert("Copied!");
});

// Download
document.getElementById("downloadCsv").addEventListener("click", () => {
    const blob = new Blob([csvEditor.getValue()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.csv";
    a.click();
});

// Clear
document.getElementById("clearBtn").addEventListener("click", () => {
    jsonEditor.setValue("");
    csvEditor.setValue("");
});

// Sample JSON
document.getElementById("sampleBtn").addEventListener("click", () => {
    const sample = [
    { "id": 1, "name": "Munzir", "role": "Dev" },
    { "id": 2, "name": "Nabeel", "role": "Engineer" }
    ];
    jsonEditor.setValue(JSON.stringify(sample, null, 2), -1);
});