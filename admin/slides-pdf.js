// Slide Viewer "slides" field: the normal list plus an "Add slides from PDF" button.
// Each PDF page is rendered to a JPEG in the browser, all pages are committed in ONE commit
// under images/meetings/<pdf-name>/, then appended to the slide list.
(function () {
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var MAX_WIDTH = 1600;

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error('Could not load the PDF reader (check your connection).')); };
      document.head.appendChild(s);
    });
  }

  async function pdfToJpegs(file, onProgress) {
    var pdf = await (await loadPdfJs()).getDocument({ data: await file.arrayBuffer() }).promise;
    var out = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var scale = Math.min(2, MAX_WIDTH / page.getViewport({ scale: 1 }).width);
      var vp = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push(await new Promise(function (r) { canvas.toBlob(r, 'image/jpeg', 0.85); }));
      onProgress('Converting slide ' + i + ' of ' + pdf.numPages + '...');
    }
    return out;
  }

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function loginToken() {
    var raw = localStorage.getItem('decap-cms-user') || localStorage.getItem('netlify-cms-user');
    var token = raw && JSON.parse(raw).token;
    if (!token) throw new Error('Not signed in. Reload the editor and log in with GitHub.');
    return token;
  }

  // One commit for all images (git data API) so a 36-slide deck is not 36 commits / 36 site builds.
  async function commitFiles(repo, branch, files, message, onProgress) {
    var token = loginToken();
    var api = 'https://api.github.com/repos/' + repo;
    function gh(path, method, body) {
      return fetch(api + path, {
        method: method || 'GET',
        headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      }).then(function (res) {
        if (res.ok) return res.json();
        return res.text().then(function (t) { throw new Error('GitHub ' + res.status + ': ' + t.slice(0, 200)); });
      });
    }
    var ref = await gh('/git/ref/heads/' + branch);
    var base = await gh('/git/commits/' + ref.object.sha);
    var tree = [];
    for (var i = 0; i < files.length; i++) {
      onProgress('Uploading slide ' + (i + 1) + ' of ' + files.length + '...');
      var blob = await gh('/git/blobs', 'POST', { content: await toBase64(files[i].blob), encoding: 'base64' });
      tree.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    var newTree = await gh('/git/trees', 'POST', { base_tree: base.tree.sha, tree: tree });
    var commit = await gh('/git/commits', 'POST', { message: message, tree: newTree.sha, parents: [ref.object.sha] });
    await gh('/git/refs/heads/' + branch, 'PATCH', { sha: commit.sha });
  }

  var h = window.h;
  var list = window.CMS.getWidget('list');

  var Control = window.createClass({
    getInitialState: function () { return { busy: false, status: '' }; },

    onFile: async function (e) {
      var file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var self = this;
      var p = this.props;
      var set = function (status, busy) { self.setState({ status: status, busy: !!busy }); };
      try {
        set('Reading PDF...', true);
        var dir = 'images/meetings/' + file.name.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        var jpegs = await pdfToJpegs(file, set.bind(null));
        var total = jpegs.length;
        var files = jpegs.map(function (blob, i) {
          return { blob: blob, path: dir + '/slide-' + String(i + 1).padStart(2, '0') + '.jpg' };
        });
        var backend = p.config.get('backend');
        await commitFiles(backend.get('repo'), backend.get('branch') || 'main', files, 'Add slides from PDF: ' + file.name, set.bind(null));
        // Decap's list/map values are Immutable; clear() gives empty ones of the right type without importing it.
        var data = p.entry.get('data');
        var current = p.value || data.keySeq().toList().clear();
        var items = files.map(function (f, i) {
          return data.clear().set('image', f.path).set('alt', 'Slide ' + (i + 1) + ' of ' + total);
        });
        p.onChange(current.concat(items));
        set('Added ' + total + ' slides. Click Publish to save the page.', false);
      } catch (err) {
        console.error(err);
        set('Failed: ' + err.message, false);
      }
    },

    render: function () {
      var busy = this.state.busy;
      return h('div', null,
        h('div', { style: { margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '12px' } },
          h('label', {
            style: {
              display: 'inline-block', padding: '8px 14px', borderRadius: '4px', fontWeight: 600,
              background: busy ? '#bbb' : '#3a69c7', color: '#fff', cursor: busy ? 'default' : 'pointer'
            }
          },
            'Add slides from PDF',
            h('input', { type: 'file', accept: 'application/pdf', style: { display: 'none' }, disabled: busy, onChange: this.onFile })),
          h('span', null, this.state.status)),
        h(list.control, this.props));
    }
  });

  window.CMS.registerWidget('slidesPdf', Control, list.preview);
})();
