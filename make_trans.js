const Jimp = require('jimp');

async function processImages() {
    async function cropAndSave(path, outPath) {
        console.log(`Processing ${path}...`);
        try {
            const image = await Jimp.read(path);
            image.autocrop();
            await image.writeAsync(outPath);
            console.log(`Saved properly cropped logo to ${outPath}`);
        } catch (e) {
            console.error('Error processing image:', e);
        }
    }

    // Ensure the logo has no invisible padding so it displays at full size
    await cropAndSave(
        'C:/Users/Administrator/.gemini/antigravity/fundii-app/public/assets/fundii-logo.png',
        'C:/Users/Administrator/.gemini/antigravity/fundii-app/public/assets/fundii-logo.png'
    );
}

processImages();
