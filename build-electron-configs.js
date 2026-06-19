// Electron builder configuration generator
function getMacConfig(withDist = false) {
  if (withDist) {
    return {
      target: [
        {
          target: 'zip',
          arch: ['arm64', 'x64']
        }
      ],
      icon: 'electron/assets/icon.icns'
    };
  } else {
    return {
      target: [
        {
          target: 'dir',
          arch: ['arm64', 'x64']
        }
      ],
      icon: 'electron/assets/icon.icns'
    };
  }
}

module.exports = { getMacConfig };