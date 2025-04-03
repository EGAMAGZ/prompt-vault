/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const cp = require('child_process');
const chokidar = require('chokidar');
const electron = require('electron');
const path = require('path');

let child = null;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const reloadWatcher = {
  debouncer: null,
  ready: false,
  watcher: null,
  restarting: false,
};

function runBuild() {
  return new Promise((resolve, reject) => {
    console.log('Starting build process...');
    const options = {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    };
    
    let tempChild = cp.spawn(npmCmd, ['run', 'build'], options);
    
    tempChild.on('error', (err) => {
      console.error('Failed to start build process:', err);
      reject(err);
    });
    
    tempChild.once('exit', (code) => {
      if (code === 0) {
        console.log('Build completed successfully');
        resolve();
      } else {
        console.error(`Build process exited with code ${code}`);
        // Still resolve to continue the process
        resolve();
      }
    });
    
    tempChild.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    tempChild.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

async function spawnElectron() {
  if (child !== null) {
    child.stdin.pause();
    child.kill();
    child = null;
    await runBuild();
  }
  
  try {
    console.log('Starting Electron...');
    child = cp.spawn(electron, ['--inspect=5858', './'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    child.on('error', (err) => {
      console.error('Failed to start Electron:', err);
    });
    
    child.on('exit', (code) => {
      console.log(`Electron process exited with code ${code}`);
      if (!reloadWatcher.restarting) {
        process.exit(0);
      }
    });
    
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  } catch (error) {
    console.error('Error spawning Electron:', error);
  }
}

function setupReloadWatcher() {
  try {
    reloadWatcher.watcher = chokidar
      .watch('./src/**/*', {
        ignored: /[/\\]\./,
        persistent: true,
      })
      .on('ready', () => {
        reloadWatcher.ready = true;
        console.log('File watcher ready, monitoring for changes...');
      })
      .on('all', (_event, _path) => {
        if (reloadWatcher.ready) {
          clearTimeout(reloadWatcher.debouncer);
          reloadWatcher.debouncer = setTimeout(async () => {
            try {
              console.log('Restarting');
              reloadWatcher.restarting = true;
              await spawnElectron();
              reloadWatcher.restarting = false;
              reloadWatcher.ready = false;
              clearTimeout(reloadWatcher.debouncer);
              reloadWatcher.debouncer = null;
              reloadWatcher.watcher = null;
              setupReloadWatcher();
            } catch (error) {
              console.error('Error during restart:', error);
              reloadWatcher.restarting = false;
            }
          }, 500);
        }
      });
  } catch (error) {
    console.error('Error setting up file watcher:', error);
  }
}

(async () => {
  try {
    await runBuild();
    await spawnElectron();
    setupReloadWatcher();
  } catch (error) {
    console.error('Error in initialization:', error);
    process.exit(1);
  }
})();