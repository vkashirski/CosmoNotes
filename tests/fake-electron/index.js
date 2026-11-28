const EventEmitter = require('events');
const handlers = {}, listeners = {};
let nextId = 1;
const all = [];
class WebContents extends EventEmitter { constructor(w){ super(); this.win=w; this.sent=[]; this.session={addWordToSpellCheckerDictionary(){}} } send(ch, ...a){ this.sent.push(ch); (this.sentArgs || (this.sentArgs = [])).push([ch, ...a]); } setWindowOpenHandler(f){ this.openHandler=f } replaceMisspelling(){} isDestroyed(){ return this.win.destroyed } }
class BrowserWindow extends EventEmitter {
  constructor(o){ super(); this.o=o; this.id=nextId++; this.bounds={x:o.x??100,y:o.y??100,width:o.width,height:o.height}; this.webContents=new WebContents(this); this.destroyed=false; this.visible=false; this.top=false; this.opacity=1; all.push(this); }
  loadFile(f){ this.file=f; setImmediate(()=>{ if(!this.destroyed) this.emit('ready-to-show'); }); }
  loadURL(u){ this.url=u; module.exports.__loaded.push(this); }
  show(){this.visible=true;this.unmin()} showInactive(){this.visible=true;this.unmin()} unmin(){ if(this.minimized){this.minimized=false;this.emit('restore')} } hide(){this.visible=false} focus(){} isFocused(){return !!this.focused} setParentWindow(p){this.parent=p} destroy(){this.close()}
  close(){ if(this.destroyed) return; this.destroyed=true; this.emit('closed'); }
  isDestroyed(){return this.destroyed} isMinimized(){return !!this.minimized} isMaximized(){return !!this.maximized} minimize(){this.minimized=true;this.visible=true;this.emit('minimize')} maximize(){this.maximized=true;this.emit('maximize')} unmaximize(){this.maximized=false;this.emit('unmaximize')} setMinimizable(v){this.minimizable=v} setMaximizable(){} isVisible(){return !!this.visible && !this.minimized} restore(){ if(this.minimized){this.minimized=false;this.emit('restore')} }
  getBounds(){return {...this.bounds}} setBounds(b){Object.assign(this.bounds,b)} setPosition(x,y){this.bounds.x=x;this.bounds.y=y;this.emit('move')} setSize(w,h){this.bounds.width=w;this.bounds.height=h;this.emit('resize')}
  setMinimumSize(){} setMaximumSize(){} setOpacity(v){this.opacity=v} setIgnoreMouseEvents(v,o){this.ignoreMouse=v?{forward:!!(o&&o.forward)}:false} setAlwaysOnTop(v){this.top=!!v; if(v) module.exports.__onTopCalls.push(this)} isAlwaysOnTop(){return !!this.top} setBackgroundColor(c){this.bg=c} setTitle(t){this.title=t} moveTop(){ module.exports.__moveTops.push(this) } flashFrame(v){this.flashing=!!v}
  moveAbove(id){ this.above = id } // 1.4.5: app pins put a note just above its app's window
  getNativeWindowHandle(){ const b=Buffer.alloc(8); b.writeBigUInt64LE(BigInt(5000+this.id)); return b } // 1.4.5: HWND = 5000 + id
  static fromWebContents(wc){ return wc.win } static getAllWindows(){ return all.filter(w=>!w.destroyed) }
}
function fakeImage(w, h, bytes, empty) {
  const fill = (head, n) => Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, Math.round(n) - head.length))]);
  return { bytes, isEmpty: () => empty, getSize: () => ({ width: w, height: h }), resize: (o) => fakeImage(o.width, o.height, [], false),
    toPNG: () => fill([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], w * h), toJPEG: (q) => fill([0xff, 0xd8, 0xff, 0xe0], (w * h * q) / 400) };
}
const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
// 1.4.1: a test can add monitors (E.__displays) and move the mouse (E.__cursor): getDisplayNearestPoint finds its monitor
const shows = () => module.exports.__displays || [display];
const near = (p) => shows().find(({ workArea: a }) => p.x >= a.x && p.x < a.x + a.width && p.y >= a.y && p.y < a.y + a.height) || shows()[0];
module.exports = {
  __handlers: handlers, __listeners: listeners, __all: all, __loaded: [], __partitions: {},
  __popups: [],
  __onTopCalls: [], // 1.4.2: every setAlwaysOnTop(true), in order: Windows puts each one above the others
  __moveTops: [], // 1.4.18: every moveTop(), in order: the last one is on top

  app: Object.assign(new EventEmitter(), { commandLine: { appendSwitch(){} }, setAppUserModelId(){}, requestSingleInstanceLock:()=>true, whenReady:()=>Promise.resolve(), getPath:(k)=> k==='appData' ? process.env.FAKE_APPDATA : process.env.FAKE_DATA, isPackaged:false, getVersion:()=>'1.0.0', quit(){ module.exports.app.emit('before-quit'); module.exports.app.emit('will-quit'); }, setLoginItemSettings(){} }),
  BrowserWindow,
  ipcMain: { handle:(c,f)=>handlers[c]=f, on:(c,f)=>listeners[c]=f },
  screen: Object.assign(new EventEmitter(), { getAllDisplays:()=>shows(), getPrimaryDisplay:()=>display, getDisplayMatching:(r)=>near({ x: r.x + r.width / 2, y: r.y + r.height / 2 }), getDisplayNearestPoint:(p)=>near(p), getCursorScreenPoint:()=>module.exports.__cursor || { x: 100, y: 100 } }),
  powerMonitor: new EventEmitter(), // 1.4.1: 'resume' after the PC slept
  Tray: class extends EventEmitter { constructor(){ super(); module.exports.__tray = this; } setToolTip(){} setContextMenu(m){ this.menu=m } },
  // 1.4.11: every menu shown (popup), with its template and options: __popups (the text's right-click menu, a note's » menu)
  Menu: { buildFromTemplate:(t)=>({ t, popup(o){ module.exports.__popups.push({ t, o }) } }), setApplicationMenu(){} },
  // 1.4.3: only a PNG decodes. 1.4.34 (Ground control's pictures): its size is read from the PNG's header; a picture's
  // PNG is 1 byte per pixel and its JPEG quality / 400 bytes per pixel, so a test can tell how small it was made
  nativeImage: { createFromPath:()=>({}), createFromBuffer:(b)=>{ const png = b.length > 4 && b[0] === 0x89 && b[1] === 0x50; const big = png && b.length >= 24; return fakeImage(big ? b.readUInt32BE(16) : +png, big ? b.readUInt32BE(20) : +png, [...b], !png); } },
  clipboard: { writeImage(i){ module.exports.__clip = i } }, // 1.4.3: Copy image
  shell: { openExternal(u){ module.exports.__opened = u }, openPath(){} },
  // 1.3.27: the panic button's shortcut. reg = what is registered (accelerator -> function); a test puts an accelerator in
  // `taken` to play another app that already has it
  globalShortcut: { reg: {}, taken: new Set(), register(a, f){ if (this.taken.has(a)) return false; this.reg[a] = f; return true }, unregister(a){ delete this.reg[a] }, unregisterAll(){ this.reg = {} }, isRegistered(a){ return !!this.reg[a] } },
  // 1.4.5: app pins (main/app-pin.js): the open windows, front first: a test sets __sources ([{ id: 'window:<hwnd>:0', name }];
  // a note window's hwnd is 5000 + its id), or __sourcesFail to make the list fail
  desktopCapturer: { calls: 0, async getSources(){ this.calls++; const E = module.exports; if (E.__sourcesFail) throw new Error('no list'); return (E.__sources || []).map((x) => ({ ...x })); } },
  dialog: { showMessageBox: async()=>({response:0}), showOpenDialog: async()=>({canceled:true}) },
  protocol: { registerSchemesAsPrivileged(){}, handle(s,f){ module.exports.__proto = f } },
  net: { fetch: async (u)=>({ url:u }) },
  session: { fromPartition(name){ const P = module.exports.__partitions; return P[name] || (P[name] = { name, protocols: {}, protocol: { handle(s, f){ P[name].protocols[s] = f } }, setPermissionRequestHandler(f){ this.perm = f }, setPermissionCheckHandler(f){ this.check = f }, webRequest: { onBeforeRequest(filter, f){ P[name].before = f } } }); },
    defaultSession: { availableSpellCheckerLanguages: ['en-US','ru','bg','sr','uk','de'], setSpellCheckerLanguages(l){ module.exports.__langs=l }, setPermissionRequestHandler(f){module.exports.__perm=f}, setPermissionCheckHandler(){} } },
  contextBridge: {}, ipcRenderer: {},
};
