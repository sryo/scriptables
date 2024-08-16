ZenTrate offers a clutter-free, elegant interface to streamline your digital life and enhance productivity.

## Features

- **Customizable Launcher**: ZenTrate.js is a productivity launcher that you can tailor to your needs. It supports adding apps, shortcuts, and other actions, all presented in a minimalist, distraction-free widget.
- **Minimalist Calendar**: ZenLendar.js provides a sleek, easy-to-read calendar widget that integrates seamlessly with ZenTrate.
- **Theme Management**: ZenTheme.js allows you to create and apply custom themes, adjusting colors, fonts, and other visual settings.
- **Menu Editor**: ZenTweak.js is our configuration editor, offering an easy way to customize your launcher without editing JSON files directly.

## Getting Started

### 1. Installation

1. Download and install the Scriptable app from the App Store.
2. Clone or download the ZenTrate repository from GitHub: [ZenTrate Repository](https://github.com/sryo/scriptables).
3. Copy the `.js` files (ZenTrate.js, ZenLendar.js, ZenTheme.js) into Scriptable.
4. Optionally, copy the ZenThemes directory.

### 2. First Run

- When you run ZenTrate for the first time, it will create a default configuration file (`zentrate_config.json`) in your iCloud Scriptable documents directory. This file contains example items (apps and shortcuts) that you can customize.
- ZenLendar provides a minimalist calendar view for your home screen.
- On the first run, ZenTheme will create a default theme (`noir.json`) and store it in the `ZenThemes` folder in your iCloud Scriptable documents directory. You can also create your own.
  
## How to use

### ZenTrate.js

- **Customizing Items**: Edit the `zentrate_config.json` file to add or remove items. Each item can be an app, shortcut, or any other action that supports a URL scheme.

- **Sorting**: Items can be sorted alphabetically or by usage frequency.
- **Autosizing**: The widget dynamically adjusts text size based on usage frequency, making more frequently used items more prominent.

### ZenLendar.js

ZenLendar displays your calendar events in a clean, concise format. It integrates directly with ZenTrate, following the same minimal design principles.

## Creating and Editing Themes

### ZenTheme.js
ZenTheme lets you manage themes for ZenTrate and ZenLendar.

| ![noir](https://github.com/user-attachments/assets/1cff7f61-64b7-403b-897e-dd5c295c7afb) | ![zen](https://github.com/user-attachments/assets/802e85e7-be47-4a6b-ace3-0f6ea2344876) | ![cartoon](https://github.com/user-attachments/assets/feb6bbc1-5ff4-4167-8061-4c3613139b3c) |
| --- | ---- | ---- |
| ![pastel](https://github.com/user-attachments/assets/520a928e-67d6-42fc-84be-4f43d0478d93) | ![terminal](https://github.com/user-attachments/assets/26a06a8a-502c-49b3-8d4c-4a1238518192) | ![elegant](https://github.com/user-attachments/assets/6a64c479-be47-41da-b418-79d48e8e6017) |


- **Select an Existing Theme**: Choose from your saved themes to apply it to ZenTrate or ZenLendar.
- **Create a New Theme**: Use the configuration UI to define a new theme with your desired settings.

## Contributing
Contributions are welcome! Whether it's adding new themes, improving existing scripts, or suggesting new features, feel free to submit a pull request or open an issue.

## Finding URL Schemes for Your Favorite Apps

To customize your launcher with specific apps, you need to know their URL schemes. Here's how to find them:

1. **Download the app you want** on your iOS device.
2. **Plug it into the computer.**
3. Download **Apple Configurator 2** from the Mac App Store.
4. **Right-click** on your iOS device in Apple Configurator and press "Add" to find the app you want to download. Once you find it, double-click it (ignore any popup messages).
5. **Go to** `~/Library/Group Containers/K36BKF7T3D.group.com.apple.configurator/Library/Caches/Assets/TemporaryItems/MobileApps/`
6. You should now see the `.ipa` file there. Change the extension to `.zip` and unzip it. Open the payload folder.
7. Go into the application's folder (Right-Click Show Package Contents on MacOS).
8. Open `Info.plist` and look for: URL Types key. One of the sub-keys in there will open the application.
