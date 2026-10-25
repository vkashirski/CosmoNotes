const EventEmitter = require('events');
const handlers = {}, listeners = {};
let nextId = 1;
const all = [];
class WebContents extends EventEmitter { constructor(w){ super(); this.win=w; this.sent=[]; this.session={addWordToSpellCheckerDictionary(){}} } send(ch, ...a){ this.sent.push(ch); (this.sentArgs || (this.sentArgs = [])).push([ch, ...a]); } setWindowOpenHandler(f){ this.openHandler=f } replaceMisspelling(){} }
class BrowserWindow extends EventEmitter {
  constructor(o){ super(); this.o=o; this.id=nextId++; this.bounds={x:o.x??100,y:o.y??100,width:o.width,height:o.height}; this.webContents=new WebContents(this); this.destroyed=false; this.visible=false; this.top=false; this.opacity=1; all.push(this); }
  loadFile(f){ this.file=f; setImmediate(()=>this.emit('ready-to-show')); }
  show(){this.visible=true} showInactive(){this.visible=true} hide(){this.visible=false} focus(){} isFocused(){return false} setParentWindow(p){this.parent=p} destroy(){this.close()}
  close(){ if(this.destroyed) return; this.destroyed=true; this.emit('closed'); }
  isDestroyed(){return this.destroyed} isMinimized(){return !!this.minimized} isMaximized(){return !!this.maximized} minimize(){this.minimized=true;this.emit('minimize')} maximize(){this.maximized=true;this.emit('maximize')} unmaximize(){this.maximized=false;this.emit('unmaximize')} setMinimizable(v){this.minimizable=v} setMaximizable(){} isVisible(){return this.visible} restore(){ if(this.minimized){this.minimized=false;this.emit('restore')} }
  getBounds(){return {...this.bounds}} setBounds(b){Object.assign(this.bounds,b)} setPosition(x,y){this.bounds.x=x;this.bounds.y=y;this.emit('move')} setSize(w,h){this.bounds.width=w;this.bounds.height=h;this.emit('resize')}
  setMinimumSize(){} setMaximumSize(){} setOpacity(v){this.opacity=v} setAlwaysOnTop(v){this.top=v} setBackgroundColor(c){this.bg=c} setTitle(t){this.title=t} moveTop(){}
  static fromWebContents(wc){ return wc.win } static getAllWindows(){ return all.filter(w=>!w.destroyed) }
}
const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
module.exports = {
  __handlers: handlers, __listeners: listeners, __all: all,
  app: Object.assign(new EventEmitter(), { commandLine: { appendSwitch(){} }, setAppUserModelId(){}, requestSingleInstanceLock:()=>true, whenReady:()=>Promise.resolve(), getPath:(k)=> k==='appData' ? process.env.FAKE_APPDATA : process.env.FAKE_DATA, isPackaged:false, getVersion:()=>'1.0.0', quit(){ module.exports.app.emit('before-quit'); module.exports.app.emit('will-quit'); }, setLoginItemSettings(){} }),
  BrowserWindow,
  ipcMain: { handle:(c,f)=>handlers[c]=f, on:(c,f)=>listeners[c]=f },
  screen: Object.assign(new EventEmitter(), { getAllDisplays:()=>[display], getPrimaryDisplay:()=>display, getDisplayMatching:()=>display, getDisplayNearestPoint:()=>display }),
  Tray: class extends EventEmitter { constructor(){ super(); module.exports.__tray = this; } setToolTip(){} setContextMenu(m){ this.menu=m } },
  Menu: { buildFromTemplate:(t)=>({ t, popup(){} }), setApplicationMenu(){} },
  nativeImage: { createFromPath:()=>({}) },
  shell: { openExternal(u){ module.exports.__opened = u }, openPath(){} },
  dialog: { showMessageBox: async()=>({response:0}), showOpenDialog: async()=>({canceled:true}) },
  protocol: { registerSchemesAsPrivileged(){}, handle(s,f){ module.exports.__proto = f } },
  net: { fetch: async (u)=>({ url:u }) },
  session: { defaultSession: { availableSpellCheckerLanguages: ['en-US','ru','bg','sr','uk','de'], setSpellCheckerLanguages(l){ module.exports.__langs=l }, setPermissionRequestHandler(f){module.exports.__perm=f}, setPermissionCheckHandler(){} } },
  contextBridge: {}, ipcRenderer: {},
};
