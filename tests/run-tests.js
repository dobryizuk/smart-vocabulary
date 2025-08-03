#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Final Test Runner\n');

// 1. Run Node.js tests
console.log('1️⃣ NODE.JS TESTS:');
try {
    const nodeResult = execSync('node test.js', { 
        cwd: __dirname,
        encoding: 'utf8' 
    });
    
    const passed = (nodeResult.match(/✅/g) || []).length;
    const failed = (nodeResult.match(/❌/g) || []).length;
    
    console.log(`✅ Node.js: ${passed}/${passed + failed} passed`);
    if (failed > 0) {
        console.log('❌ Node.js tests have failures!');
        return;
    }
    
} catch (error) {
    console.log('❌ Node.js tests failed');
    return;
}

// 2. Run browser tests
console.log('\n2️⃣ BROWSER TESTS:');
const testPath = path.join(__dirname, 'final-tests.html');

console.log('🌐 Opening browser tests in Safari...');

try {
    const openProcess = spawn('open', ['-a', 'Safari', testPath], {
        detached: true,
        stdio: 'ignore'
    });
    openProcess.unref();
    
    console.log('✅ Safari opened');
    console.log('⏳ Waiting for test completion...');
    
    // Check results via AppleScript
    let attempt = 0;
    const maxAttempts = 8;
    
    const checkResults = () => {
        attempt++;
        
        if (process.platform === 'darwin' && attempt >= 3) {
            try {
                const script = `
                tell application "Safari"
                    if (count of windows) > 0 then
                        set pageTitle to name of front document
                        return pageTitle
                    else
                        return "NO_WINDOWS"
                    end if
                end tell
                `;
                
                console.log(`🔍 Attempt ${attempt}: Reading Safari title...`);
                const titleResult = execSync(`osascript -e '${script}'`, { 
                    encoding: 'utf8',
                    timeout: 5000 
                }).trim();
                
                if (titleResult.includes('ALL_PASSED') || titleResult.includes('SOME_FAILED')) {
                    const statusMatch = titleResult.match(/(ALL_PASSED|SOME_FAILED)_(\d+)_(\d+)/);
                    if (statusMatch) {
                        const status = statusMatch[1];
                        const passed = statusMatch[2];
                        const total = statusMatch[3];
                        
                        console.log('\n✅ BROWSER RESULTS:');
                        console.log(`Status: ${status === 'ALL_PASSED' ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
                        console.log(`Tests: ${passed}/${total}`);
                        
                        // Extract failed tests from title if present
                        const failedMatch = titleResult.match(/\|FAILED:(.+)/);
                        if (failedMatch && status === 'SOME_FAILED') {
                            const failedTests = failedMatch[1].split('||');
                            console.log('\n❌ FAILED TESTS:');
                            failedTests.forEach(test => {
                                if (test.trim()) {
                                    console.log(`   ${test}`);
                                }
                            });
                        }
                        
                        // Try to get localStorage data with more detailed results
                        try {
                            const localStorageScript = `
                            tell application "Safari"
                                if (count of windows) > 0 then
                                    set jsCode to "JSON.stringify(JSON.parse(localStorage.getItem('detailedTestResults') || '{}'), null, 2)"
                                    return do JavaScript jsCode in front document
                                else
                                    return "{}"
                                end if
                            end tell
                            `;
                            
                            const detailedResult = execSync(`osascript -e '${localStorageScript}'`, { 
                                encoding: 'utf8',
                                timeout: 5000 
                            }).trim();
                            
                            if (detailedResult && detailedResult !== '{}') {
                                const detailedData = JSON.parse(detailedResult);
                                if (detailedData.failedTests && detailedData.failedTests.length > 0) {
                                    console.log('\n🔍 DETAILED FAILED TESTS:');
                                    detailedData.failedTests.forEach(test => {
                                        console.log(`   ${test}`);
                                    });
                                }
                            }
                        } catch (e) {
                            // localStorage extraction failed, that's ok
                        }
                        
                        console.log('\n🎯 FINAL SUMMARY:');
                        console.log('✅ Node.js tests: All passed');
                        console.log(`${status === 'ALL_PASSED' ? '✅' : '❌'} Browser tests: ${passed}/${total}`);
                        if (status === 'SOME_FAILED') {
                            console.log('📋 Failed test details shown above');
                        }
                        
                        return true;
                    }
                }
            } catch (e) {
                // AppleScript failed, continue
            }
        }
        
        if (attempt < maxAttempts) {
            setTimeout(checkResults, 2000);
        } else {
            console.log('\n⚠️  TIMEOUT: Could not auto-read results');
            console.log('📋 MANUAL CHECK REQUIRED:');
            console.log('1. Check Safari tab title for: ALL_PASSED_X_Y or SOME_FAILED_X_Y');
            console.log('2. View page content for detailed results');
            
            console.log('\n🎯 FINAL SUMMARY:');
            console.log('✅ Node.js tests: All passed');
            console.log('🌐 Browser tests: Check Safari manually');
        }
        
        return false;
    };
    
    setTimeout(checkResults, 3000);
    
} catch (error) {
    console.log('❌ Could not open browser test');
    console.log('💡 Manually open: final-tests.html');
}

console.log('\n📁 FILES:');
console.log('  • final-tests.html (browser tests)');
console.log('  • run-tests.js (this script)');
console.log('  • test.js (node tests)');