// 用于控制应用程序生命周期和创建本机浏览器窗口的模块
const { app, Menu, session, BrowserWindow } = require('electron')
// 保留窗口对象的全局引用，否则，当JavaScript对象被垃圾回收时，窗口将自动关闭。
let mainWindow

function createWindow() {
  Menu.setApplicationMenu(null)
  // 创建浏览器窗口。
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  })

  // 并加载应用程序的index.html。
  mainWindow.loadFile('./html/index.html')

  // 设置请求头
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    let rh = details.requestHeaders
    change_headers = JSON.parse(rh['my-change-headers'] || "[]")
    change_headers.forEach(header => {
      if(rh[header + "__"]){
        rh[header] = rh[header + "__"]
        delete rh[header + "__"]
      }
    });
    if (rh["my-change-headers"])
      delete rh["my-change-headers"]
    callback({ cancel: false, requestHeaders: rh })
  })

  // 打开DevTools。
  mainWindow.webContents.openDevTools()

  // 当窗口关闭时激活
  mainWindow.on('closed', function () {
    // 取消引用窗口对象，如果您的应用程序支持多个窗口，
    // 通常会将窗口存储在数组中，这是您应该删除相应元素的时间。
    mainWindow = null
  })
}

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// 当Electron完成初始化并准备创建浏览器窗口时，将调用此方法。
// 某些API仅在此事件发生后才能使用。
app.on('ready', createWindow)

// 关闭所有窗口后退出。
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
