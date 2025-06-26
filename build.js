const fs = require('fs-extra');
const path = require('path');

const browser = process.argv[2]; // 'chrome' or 'firefox'

if (!browser) {
    console.error('Please specify a browser: npm run build:chrome or npm run build:firefox');
    process.exit(1);
}

const sourceManifestPath = path.join(__dirname, 'src', 'manifests', `${browser}.json`);
const destinationManifestPath = path.join(__dirname, 'src', 'manifest.json');

async function build() {
    try {
        // Ensure the build directory exists (if you were building to a separate directory)
        // For this simple example, we copy directly into src/
        // await fs.ensureDir(path.join(__dirname, 'build', browser));

        // Copy the specific manifest file
        await fs.copy(sourceManifestPath, destinationManifestPath);
        console.log(`Copied ${browser}.json to src/manifest.json`);

        console.log(`Build for ${browser} complete. Ready to load 'src/' as unpacked extension.`);

    } catch (err) {
        console.error('Error during build:', err);
        process.exit(1);
    }
}

build();