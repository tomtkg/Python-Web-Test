document.addEventListener("DOMContentLoaded", function () {
    fetch("src/settings.json")
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById("select");

            for (let i = 1; i <= data.problem_count; i++) {
                let option = document.createElement("option");
                option.value = option.textContent = i;
                select.appendChild(option);
            }

            loadProblem(select.value);

            select.addEventListener("change", () => {
                loadProblem(select.value)
                document.getElementById("result").textContent = "";
                document.getElementById("resultBlock").style.backgroundColor = "#f0f0f0";
            });
        })
        .catch(error => console.error("Error loading settings.json:", error));
});

function loadProblem(number) {
    fetch(`problem/problem${number.toString().padStart(4, '0')}.json`)
        .then(response => response.json())
        .then(data => {
            document.getElementById("format").textContent = data.format;
            document.getElementById("main").innerHTML = data.main.replace(/\n/g, "<br>");

            const input = document.getElementById("input");
            const expect = document.getElementById("expect");
            const output = document.getElementById("output");
            input.innerHTML = expect.innerHTML = output.innerHTML = "";

            const h = parseFloat(getComputedStyle(document.querySelector("pre")).lineHeight) || 13;

            data.example.forEach((x, i) => {
                const n = Math.max(x.input.split("\n").length, x.output.split("\n").length);
                input.innerHTML += `<p>入力例${i + 1}</p><pre style="height: ${h * n}px;">${x.input}</pre>`;
                expect.innerHTML += `<p>出力例${i + 1}</p><pre style="height: ${h * n}px;">${x.output}</pre>`;
                output.innerHTML += `<p>解答${i + 1}</p><pre style="min-height: ${h * n}px; height: auto;"></pre>`;
            });
            window.data = data;
        })
        .catch(error => console.error(`Error loading problem${number.toString().padStart(4, '0')}.json:`, error));
}

const pyodideReady = loadPyodide().then(async pyodide => (
    await pyodide.loadPackage(["numpy", "pandas", "scikit-learn", "scipy"]), pyodide));

require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

require(['vs/editor/editor.main'], async function () {
    const editor = monaco.editor.create(document.getElementById("editor"), {
        value: 'a = input()\nprint(a)',
        language: 'python',
        fontSize: 18,
        wordWrap: 'on',
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        if (!document.getElementById("exe").disabled) window.main();
    });

    window.main = async function () {
        document.getElementById("exe").disabled = true;
        document.getElementById("loading").textContent = "プログラム実行中...";
        document.querySelectorAll("#output pre").forEach(pre => pre.innerText = "");

        const code = editor.getValue();
        let pyodide = await pyodideReady;
        let outputElems = document.querySelectorAll("#output pre");
        let isCorrect = true;

        window.data.example.forEach((x, i) => {
            let outputElem = outputElems[i];
            pyodide.setStdin({
                lines: x.input.trim().split("\n"),
                stdin() { return this.lines.shift() || undefined; }
            });
            pyodide.setStdout({ batched: (msg) => { outputElem.innerText += msg + "\n" } });

            try { pyodide.runPython(code) }
            catch (error) { outputElem.innerText = error }

            const a = x.output.trim();
            const b = outputElem.innerText.trim();

            if (!isNaN(a) && !isNaN(b)) {
                if (Math.abs(a - b) > 1e-6) { isCorrect = false }
            } else {
                if (a != b) { isCorrect = false }
            }
        });

        let result = document.getElementById('result');
        let bg = document.getElementById("resultBlock");

        result.textContent = isCorrect ? '正解' : '不正解';
        result.style.color = isCorrect ? "crimson" : "mediumblue";
        bg.style.backgroundColor = isCorrect ? "lavenderblush" : "azure";

        document.getElementById("loading").textContent = "";
        document.getElementById("exe").disabled = false;
    };

    window.answer = () => window.data &&
        editor.setValue(editor.getValue() + `# 解答例\n${window.data.answer}\n`);

    window.remove = () => {
        editor.setValue("");
        document.getElementById("result").textContent = "";
        document.getElementById("resultBlock").style.backgroundColor = "#f0f0f0";
        document.querySelectorAll("#output pre").forEach(pre => pre.innerText = "");
    };
});
