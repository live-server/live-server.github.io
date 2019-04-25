class Cache {

    constructor() {
        this._cache = caches.open('live_server');
    }

    async put(object) {
        const cache = await this._cache;
        await cache.put(object.path, new Response(object.file));
    }
}

class ActiveFile {

    constructor(file) {
        this._lastModified = 0;
        this._file = file;
    }

    isDirty() {
        return this._lastModified < this._file.lastModified;
    }

    get name() {
        return this._file.name;
    }

    get relativePath() {
        return this._file.webkitRelativePath || this._file._webkitRelativePath || this._file.relativePath;
    }

    get path() {
        if (!this.relativePath || this.relativePath == '/' + this.name) {
            return this.name;
        }
        let path = this.relativePath;
        if (path.startsWith('/')) {
            path = path.substr(1);
        }
        path = path.split('/');
        path.shift();
        path = path.join('/');
        return path;
    }

    get root() {
        if (!this.relativePath || this.relativePath == '/' + this.name) {
            return '/';
        }
        let path = this.relativePath;
        if (path.startsWith('/')) {
            path = path.substr(1);
        }
        path = path.split('/');
        return path.shift();
    }

    serialize() {
        const path = this.path;
        const file = this._file;
        return { path, file }
    }

    clean() {
        this._lastModified = this._file.lastModified;
    }

    isHidden() {
        return this.name.startsWith('.') || this.path.startsWith('.');
    }
}

class FilesWatcher {

    constructor(cache) {
        this._activeFiles = {};
        this._cache = cache;
        this._window = null;
    }

    _watchFile(file) {
        const activeFile = new ActiveFile(file);
        if (activeFile.isHidden()) return; // ignore hidden files
        this._activeFiles[activeFile.path] = activeFile;
        if (activeFile.name === 'index.html') setTimeout(_ => openLive('index.html'), 300)
    }

    watchFiles(files) {
        console.log(`FileWatcher: Watching ${files.length} files`);
        this._activeFiles = {};
        for (let i = 0; i < files.length; i++) {
            this._watchFile(files[i]);
        }
        this.start();
    }

    _watch() {
        let someDirty = false;
        for (let key in this._activeFiles) {
            const activeFile = this._activeFiles[key];
            if (!activeFile || !activeFile.isDirty()) continue;
            someDirty = true;

            this._cache.put(activeFile.serialize());
            activeFile.clean();
        }
        if (!someDirty) return;
        _window.location.reload();
    }

    start() {
        clearInterval(this._timer);
        this._timer = setInterval(_ => this._watch(), 100);
    }

    pause() {
        clearInterval(this._timer);
    }

    get files() {
        return this._activeFiles;
    }
}

class DirectoryListing {

    constructor() {

    }

    list(files) {
        directory.innerHTML = '';
        const rootDir = files[Object.keys(files)[0]].root;
        if (rootDir !== '/') {
            document.querySelector('#serve h3').innerHTML = 'Serving <i>"' + rootDir + '"</i>';
        } else {
            document.querySelector('#serve h3').innerHTML = 'Virtual Directory';
        }
        directory.innerHTML += '<ul>'
        for (let key in files) {
            const file = files[key];
            directory.innerHTML += '<li><a target="live_file" onclick=openLive("' + file.path + '") >' + file.path + '</a></li>';
        }
        directory.innerHTML += '</ul>';
    }
}

let openLive = path => {
    window._window = window.open(path, "live_file");
}

let filesWatcher = new FilesWatcher(new Cache());
let directoryListing = new DirectoryListing();

input.addEventListener('input', _ => onFiles(input.files));

function onFiles(files) {
    if (!files) return;
    filesWatcher.watchFiles(files);
    directoryListing.list(filesWatcher.files);
    location = '#serve';
    input.files = null;
    input.value = null;
}


function traverseFileTree(item, path) {
    path = path || "";
    if (item.isFile) {
        // Get file
        item.file(function(file) {
            file._webkitRelativePath = '/' + path + file.name;
            droppedFiles.push(file);
            console.log("File:", file);
        });
    } else if (item.isDirectory) {
        // Get folder contents
        var dirReader = item.createReader();
        dirReader.readEntries(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                traverseFileTree(entries[i], path + item.name + "/");
            }
        });
    }
}

function dropHandler(event) {
    event.preventDefault();
    droppedFiles = [];
    var items = event.dataTransfer.items;
    for (var i = 0; i < items.length; i++) {
        // webkitGetAsEntry is where the magic happens
        var item = items[i].webkitGetAsEntry();
        if (item) {
            traverseFileTree(item);
        }
    }
    setTimeout(e => onFiles(droppedFiles), 300);
}

function dragOverHandler(ev) {
    ev.preventDefault();
}

document.body.addEventListener("drop", dropHandler, false);
document.body.addEventListener("dragover", dragOverHandler, false);

location = '#';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
} else {
    alert('Live Server doesn\'t work on your browser');
}