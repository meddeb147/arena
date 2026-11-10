import { Config } from '@remotion/cli/config';

// Use the Chromium already installed on this machine (Remotion's own download is not needed).
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(17);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(4);
Config.setOverwriteOutput(true);
