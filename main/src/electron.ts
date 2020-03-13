import {
  BrowserWindow,
  app,
  ipcMain,
  IpcMainEvent,
  screen,
  systemPreferences,
  globalShortcut
} from "electron";
import * as isDev from "electron-is-dev";
import * as path from "path";

let mainWindow: BrowserWindow;

const installExtensions = async () => {
  console.log("installing extensions");
  const installer = require("electron-devtools-installer");
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ["REACT_DEVELOPER_TOOLS", "REDUX_DEVTOOLS"];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(console.log); // eslint-disable-line no-console
};

const createWindow = async () => {
  systemPreferences.isTrustedAccessibilityClient(true);
  const displays = screen.getAllDisplays();
  const placement = displays[0].workArea;

  if (isDev) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    x: placement.width - 250,
    y: placement.y,
    width: 250,
    height: 250,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    icon: `${__dirname}/Icon/Icon.icns`,
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  globalShortcut.register("MediaPlayPause", () => {
    mainWindow && mainWindow.webContents.send("MediaPlayPause");
  });
  globalShortcut.register("MediaNextTrack", () => {
    mainWindow && mainWindow.webContents.send("MediaNextTrack");
  });
  globalShortcut.register("MediaPreviousTrack", () => {
    mainWindow && mainWindow.webContents.send("MediaPreviousTrack");
  });

  mainWindow.on("closed", () => mainWindow.destroy());

  ipcMain.on("channel", (event: IpcMainEvent, msg: any) => {
    console.log(msg);
    mainWindow.webContents.send("response", { title: "mymessage", data: 1 });
  });

  mainWindow.webContents.once("dom-ready", () => {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  });
};

app.on("ready", createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
ipcMain.on("resize", (e, x, y) => {
  if (mainWindow) {
    mainWindow.setSize(x, y);
  }
});
