import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

async function loginTest() {
    const options = new chrome.Options();
    // options.addArguments('--headless'); // Use this if you don't want a browser window to open

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        console.log('🧪 Starting Login Test...');
        await driver.get('http://localhost:5174/login');

        console.log('📍 Navigated to login page.');

        // Wait for the email input to be visible
        await driver.wait(until.elementLocated(By.id('login-email')), 10000);

        // Enter credentials
        await driver.findElement(By.id('login-email')).sendKeys('admin@gmail.com');
        await driver.findElement(By.id('login-password')).sendKeys('admin123');

        console.log('📝 Entered credentials.');

        // Click the login button
        await driver.findElement(By.id('login-button')).click();

        console.log('🔘 Clicked login button.');

        // Wait for navigation - checking for any dashboard in the URL
        await driver.wait(until.urlContains('dashboard'), 10000);

        const currentUrl = await driver.getCurrentUrl();
        console.log(`✅ Login Successful! Current URL: ${currentUrl}`);

    } catch (error) {
        console.error(`❌ Test Failed: ${error.message}`);
        // Take a screenshot if possible? (Optional but good for debugging)
    } finally {
        console.log('🏁 Closing browser...');
        await driver.quit();
    }
}

loginTest();
