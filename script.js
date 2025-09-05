// --- Globals ---
let editor;
const initialJson =  {
    "name": "Munzir Nabeel",
    "mood": "😎",
    "skills": ["JSON juggling", "Bug whispering", "Code teleportation"],
    "coffeeLevel": "High ☕",
    "status": "Currently debugging the Matrix"

};

// --- Editor Setup ---
function setupEditor() {
    editor = ace.edit("editor");
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/json");
    editor.session.setUseWrapMode(true);
    editor.renderer.setShowGutter(true);
    editor.setOptions({
        fontSize: "14px",
        fontFamily: "monospace"
    });
    editor.setValue(JSON.stringify(initialJson, null, 2), -1);
    editor.on("change", handleEditorChange);
}

// --- Tree View ---
function updateTreeView(jsonString) {
    const treeContainer = document.getElementById('tree-view-container');
    const statusIndicator = document.getElementById('status-indicator');

    try {
        const data = JSON.parse(jsonString);
        treeContainer.innerHTML = '';
        const treeElement = buildTree(data);
        treeContainer.appendChild(treeElement);
        statusIndicator.classList.remove('bg-red-500');
        statusIndicator.classList.add('bg-green-500');
        statusIndicator.title = "Valid JSON";
    } catch (error) {
        treeContainer.innerHTML = `<p class="text-red-500 font-mono text-sm p-2 bg-red-50 rounded-md"><b>Error:</b> ${error.message}</p>`;
        statusIndicator.classList.remove('bg-green-500');
        statusIndicator.classList.add('bg-red-500');
        statusIndicator.title = "Invalid JSON";
    }
}

function buildTree(data) {
    const root = document.createElement('div');
    root.appendChild(createNode(null, data));
    return root;
}

function createNode(key, value) {
    const node = document.createElement('div');
    node.className = 'node-container';
    const type = typeof value;

    if (Array.isArray(value)) {
        node.appendChild(createExpandableNode(key, value, 'array'));
    } else if (type === 'object' && value !== null) {
        node.appendChild(createExpandableNode(key, value, 'object'));
    } else {
        node.appendChild(createValueNode(key, value));
    }
    return node;
}

function createExpandableNode(key, data, type) {
    const isArray = type === 'array';
    const container = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'flex items-center py-1';

    const toggle = document.createElement('span');
    toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    toggle.className = 'toggle mr-2 text-xs';
    
    const keySpan = document.createElement('span');
    if (key !== null) {
        keySpan.textContent = `"${key}": `;
        keySpan.className = 'key font-mono';
        header.appendChild(keySpan);
    }

    const typeSpan = document.createElement('span');
    typeSpan.textContent = isArray ? `Array[${data.length}]` : `Object {${Object.keys(data).length}}`;
    typeSpan.className = 'text-gray-500 font-mono text-sm';
    header.appendChild(typeSpan);
    
    header.insertBefore(toggle, header.firstChild);

    const childContainer = document.createElement('ul');

    if (isArray) {
        data.forEach((item, index) => {
            const li = document.createElement('li');
            li.appendChild(createNode(index, item));
            childContainer.appendChild(li);
        });
    } else {
        Object.entries(data).forEach(([childKey, childValue]) => {
            const li = document.createElement('li');
            li.appendChild(createNode(childKey, childValue));
            childContainer.appendChild(li);
        });
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        childContainer.style.display = childContainer.style.display === 'none' ? 'block' : 'none';
        toggle.classList.toggle('collapsed');
    });

    container.appendChild(header);
    container.appendChild(childContainer);
    return container;
}

function createValueNode(key, value) {
    const node = document.createElement('div');
    node.className = 'font-mono py-1';
    
    const keySpan = document.createElement('span');
    if (key !== null) {
        const keyText = typeof key === 'number' ? `${key}: ` : `"${key}": `;
        keySpan.textContent = keyText;
        keySpan.className = 'key';
        node.appendChild(keySpan);
    }

    const valueSpan = document.createElement('span');
    let valueClass = '';
    let displayValue = value;

    if (typeof value === 'string') {
        valueClass = 'value-string';
        displayValue = `"${value}"`;
    } else if (typeof value === 'number') {
        valueClass = 'value-number';
    } else if (typeof value === 'boolean') {
        valueClass = 'value-boolean';
    } else if (value === null) {
        valueClass = 'value-null';
        displayValue = 'null';
    }
    
    valueSpan.textContent = displayValue;
    valueSpan.className = valueClass;
    node.appendChild(valueSpan);

    return node;
}

// --- Event Handlers ---
function handleEditorChange() {
    const content = editor.getValue();
    updateTreeView(content);
}

function handleFormat() {
    try {
        const currentJson = JSON.parse(editor.getValue());
        editor.setValue(JSON.stringify(currentJson, null, 2), -1);
    } catch (e) {
        console.error("Cannot format invalid JSON.");
    }
}

function handleClear() {
    editor.setValue('{}', -1);
}

// --- Splitter Logic ---
function setupSplitter() {
    const splitter = document.getElementById('splitter');
    const editorContainer = document.getElementById('editor-container');
    const mainContainer = document.querySelector('main');

    let isDragging = false;

    splitter.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; 
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const mainRect = mainContainer.getBoundingClientRect();
        let newEditorWidth = e.clientX - mainRect.left;
        
        const minWidth = 150; 
        const splitterWidth = splitter.offsetWidth;
        const splitterMargins = 16; 
        const maxWidth = mainContainer.clientWidth - minWidth - splitterWidth - splitterMargins;

        if (newEditorWidth < minWidth) newEditorWidth = minWidth;
        if (newEditorWidth > maxWidth) newEditorWidth = maxWidth;

        editorContainer.style.flexBasis = `${newEditorWidth}px`;
        editor.resize(); 
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto'; 
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEditor();
    updateTreeView(editor.getValue());
    setupSplitter();

    document.getElementById('format-btn').addEventListener('click', handleFormat);
    document.getElementById('clear-btn').addEventListener('click', handleClear);
});