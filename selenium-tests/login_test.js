import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\vsadi\\.gemini\\antigravity\\brain\\423e6d1b-4151-407b-9abe-4c8a30ef168b';

async function loginTest() {
    const options = new chrome.Options();
    options.addArguments('--headless'); // Use this if you don't want a browser window to open

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        console.log('🧪 Starting Login Test...');
        await driver.get('http://127.0.0.1:5174/login');

        console.log('📍 Navigated to login page.');

        // Wait for the email input to be visible
        await driver.wait(until.elementLocated(By.id('login-email')), 10000);

        // Enter credentials
        await driver.findElement(By.id('login-email')).sendKeys('admin@gmail.com');
        await driver.findElement(By.id('login-password')).sendKeys('admin123');

        console.log('📝 Entered credentials.');

        // Click the login button using executeScript to bypass any overlays (like loaders)
        const loginButton = await driver.findElement(By.id('login-button'));
        await driver.executeScript("arguments[0].click();", loginButton);

        console.log('🔘 Clicked login button.');

        // Wait for navigation - checking for any dashboard in the URL
        await driver.wait(until.urlContains('dashboard'), 10000);

        const currentUrl = await driver.getCurrentUrl();
        console.log(`✅ Login Successful! Current URL: ${currentUrl}`);

        // Capture screenshot
        const screenshot = await driver.takeScreenshot();
        const screenshotPath = path.join(ARTIFACTS_DIR, 'login_success.png');
        fs.writeFileSync(screenshotPath, screenshot, 'base64');
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    } catch (error) {
        console.error(`❌ Test Failed: ${error.message}`);
        // Take a screenshot if possible? (Optional but good for debugging)
    } finally {
        console.log('🏁 Closing browser...');
        await driver.quit();
    }
}

loginTest();
