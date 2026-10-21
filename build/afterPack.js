// Puts the CosmoNotes icon and name on CosmoNotes.exe (instead of the default Electron ones).
const path = require('path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const mod = require('rcedit');
  const rcedit = mod.rcedit || mod.default || mod;
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const version = ctx.packager.appInfo.version;
  await rcedit(exe, {
    icon: path.join(__dirname, 'icon.ico'),
    'file-version': version,
    'product-version': version,
    'version-string': {
      ProductName: 'CosmoNotes',
      FileDescription: 'CosmoNotes',
      CompanyName: 'CosmoNotes',
      LegalCopyright: 'CosmoNotes',
      OriginalFilename: 'CosmoNotes.exe',
      InternalName: 'CosmoNotes',
    },
  });
};
