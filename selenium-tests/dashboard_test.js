import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\vsadi\\.gemini\\antigravity\\brain\\423e6d1b-4151-407b-9abe-4c8a30ef168b';

async function dashboardTest() {
    const options = new chrome.Options();
    options.addArguments('--headless');

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        console.log('🧪 Starting Dashboard Navigation Test...');
        await driver.get('http://localhost:5174/login');

        // Wait for login form
        await driver.wait(until.elementLocated(By.id('login-email')), 10000);

        // Login
        await driver.findElement(By.id('login-email')).sendKeys('admin@gmail.com');
        await driver.findElement(By.id('login-password')).sendKeys('admin123');
        const loginButton = await driver.findElement(By.id('login-button'));
        await driver.executeScript("arguments[0].click();", loginButton);

        console.log('📝 Logged in.');

        // Wait for dashboard to load
        await driver.wait(until.urlContains('dashboard'), 10000);
        console.log('📍 Landed on dashboard.');

        // Test a few navigation items if they exist as IDs or descriptive text
        // For example, looking for specific dashboard links or headers
        try {
            // Check for a common element in the admin dashboard
            await driver.wait(until.elementLocated(By.className('text-3xl')), 5000);
            const headerText = await driver.findElement(By.className('text-3xl')).getText();
            console.log(`✅ Header text found: ${headerText}`);
        } catch (e) {
            console.log('ℹ️ Could not find specific header, but navigation was successful.');
        }

        // Capture the state
        const currentUrl = await driver.getCurrentUrl();
        console.log(`✅ Dashboard Navigation Successful! Current URL: ${currentUrl}`);

        // Capture screenshot
        const screenshot = await driver.takeScreenshot();
        const screenshotPath = path.join(ARTIFACTS_DIR, 'dashboard_success.png');
        fs.writeFileSync(screenshotPath, screenshot, 'base64');
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    } catch (error) {
        console.error(`❌ Test Failed: ${error.message}`);
    } finally {
        console.log('🏁 Closing browser...');
        await driver.quit();
    }
}

dashboardTest();
