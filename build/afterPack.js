// Puts the Sticky Pins icon and name on Sticky Pins.exe (instead of the default Electron ones).
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
      ProductName: 'Sticky Pins',
      FileDescription: 'Sticky Pins',
      CompanyName: 'Sticky Pins',
      LegalCopyright: 'Sticky Pins',
      OriginalFilename: 'Sticky Pins.exe',
      InternalName: 'Sticky Pins',
    },
  });
};
