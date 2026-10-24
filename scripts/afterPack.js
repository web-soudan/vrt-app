const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Arch } = require('electron-builder');

// パッケージ後のリソースディレクトリ（.app バンドル内など）の絶対パスを求める。
// electron-builder の Platform クラスに buildResourcesDir プロパティは存在しないため、
// electronPlatformName と productFilename から組み立てる。
function resolveResourcesPath({ appOutDir, packager, electronPlatformName }) {
  if (electronPlatformName === 'darwin') {
    const appName = packager.appInfo.productFilename;
    return path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
  }
  return path.join(appOutDir, 'resources');
}

// Playwright は既定でビルドを実行しているホストマシンのCPUアーキテクチャ向けの
// バイナリをダウンロードする。そのため Apple Silicon 機で Intel(x64) 向けを
// ビルドすると、誤って arm64 版の Chromium が同梱されてしまう
// （Intel Mac では実行できないバイナリになる）。
// PLAYWRIGHT_HOST_PLATFORM_OVERRIDE でホストではなく「ビルド対象アーキテクチャ」
// 向けの識別子を明示的に指定し、常に正しいバイナリを取得させる。
// ロジックは playwright-core/lib/server/utils/hostPlatform.js の darwin 判定を、
// ホストCPU判定ではなくターゲットアーキテクチャ判定に置き換えたもの。
function macPlaywrightPlatformOverride(archName) {
  const ver = os.release().split('.').map((n) => parseInt(n, 10));
  if (ver[0] < 18) return 'mac10.13';
  if (ver[0] === 18) return 'mac10.14';
  if (ver[0] === 19) return 'mac10.15';
  const LAST_STABLE_MACOS_MAJOR_VERSION = 15;
  const base = 'mac' + Math.min(ver[0] - 9, LAST_STABLE_MACOS_MAJOR_VERSION);
  return archName === 'arm64' ? `${base}-arm64` : base;
}

exports.default = async function(context) {
  const { electronPlatformName, arch } = context;
  const resourcesPath = resolveResourcesPath(context);
  const serverPath = path.join(resourcesPath, 'server');
  const browsersPath = path.join(resourcesPath, 'playwright-browsers');

  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
  };
  if (electronPlatformName === 'darwin') {
    env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = macPlaywrightPlatformOverride(Arch[arch]);
  }

  console.log(`Installing Playwright browsers into ${browsersPath} (target: ${env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE || 'host default'}) ...`);

  // サーバーディレクトリで（同梱される playwright パッケージのバージョンに合わせて）
  // Chromium をアプリバンドル内の専用ディレクトリへインストールする。
  // 実行時（server/index.js の起動時）に同じ PLAYWRIGHT_BROWSERS_PATH を渡すことで、
  // エンドユーザーの環境で npx 等に頼らず起動時から参照できるようにする。
  // npx は同梱先に .bin が無いと上位ディレクトリや npm レジストリの別バージョンの
  // playwright を使ってしまい、同梱版と合わない Chromium が入るため、同梱した
  // playwright の CLI を直接実行する。
  const playwrightCli = path.join(serverPath, 'node_modules', 'playwright', 'cli.js');
  execFileSync(process.execPath, [playwrightCli, 'install', 'chromium'], {
    stdio: 'inherit',
    cwd: serverPath,
    env,
  });

  console.log('Playwright browsers installed successfully');
};