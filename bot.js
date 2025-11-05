/**
 * Group Nickname Locker Bot (Single Nickname for All)
 * Developer: Axshu 🩷
 * Description: Sets same nickname for all members and resets in 4 seconds if changed.
 */

const login = require("fca-unofficial");
const fs = require("fs");
const express = require("express");

// ✅ Load AppState from separate file
let appState;
try {
  appState = JSON.parse(fs.readFileSync("appstate.json", "utf-8"));
  console.log("✅ AppState loaded successfully");
} catch (err) {
  console.error("❌ Error reading appstate.json:", err.message);
  process.exit(1);
}

// ✅ Configuration
const CONFIG = {
  GROUP_THREAD_ID: "1150460107221550",        
  LOCKED_NICKNAME: "आफत की रण्डी मां की चुदाई 🤡",
  RESET_DELAY: 4000, // 4 seconds
  POLL_INTERVAL: 30000, // 30 seconds
};

// ✅ Store group members
let groupMembers = [];

// ✅ Express Server
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("🤖 Nickname Locker Bot - Axshu 🩷"));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

/**
 * Load all group members
 */
function loadGroupMembers(api) {
  return new Promise((resolve, reject) => {
    api.getThreadInfo(CONFIG.GROUP_THREAD_ID, (err, info) => {
      if (err) reject(err);
      else {
        groupMembers = info.participantIDs || [];
        console.log(`✅ Loaded ${groupMembers.length} members`);
        resolve(groupMembers);
      }
    });
  });
}

/**
 * Set nickname for a user
 */
function setUserNickname(api, userId) {
  return new Promise((resolve, reject) => {
    api.changeNickname(CONFIG.LOCKED_NICKNAME, CONFIG.GROUP_THREAD_ID, userId, (err) => {
      if (err) reject(err);
      else {
        console.log(`🔒 Set "${CONFIG.LOCKED_NICKNAME}" for ${userId}`);
        resolve();
      }
    });
  });
}

/**
 * Set same nickname for all members
 */
async function setAllNicknames(api) {
  try {
    console.log(`🔄 Setting nickname for ${groupMembers.length} members...`);
    
    for (const userId of groupMembers) {
      try {
        await setUserNickname(api, userId);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`⚠️ Failed for ${userId}, continuing...`);
      }
    }
    
    console.log(`✅ Nicknames set successfully`);
  } catch (error) {
    console.error("❌ Error setting nicknames:", error.message);
  }
}

/**
 * Check and reset nicknames if changed
 */
async function checkAndResetNicknames(api) {
  try {
    const info = await new Promise((resolve, reject) => {
      api.getThreadInfo(CONFIG.GROUP_THREAD_ID, (err, info) => {
        if (err) reject(err);
        else resolve(info);
      });
    });

    const currentNicknames = info.nicknames || {};
    let changesDetected = false;

    for (const userId of groupMembers) {
      const currentNickname = currentNicknames[userId] || "";
      if (currentNickname !== CONFIG.LOCKED_NICKNAME) {
        if (!changesDetected) {
          console.warn(`⚠️ Nickname changes detected! Resetting in ${CONFIG.RESET_DELAY}ms...`);
          changesDetected = true;
        }
      }
    }

    if (changesDetected) {
      setTimeout(async () => {
        await setAllNicknames(api);
      }, CONFIG.RESET_DELAY);
    }
    
    return changesDetected;
  } catch (error) {
    console.error("❌ Error checking nicknames:", error.message);
    return false;
  }
}

/**
 * Polling system
 */
function startPolling(api) {
  let stopped = false;

  function loop() {
    if (stopped) return;
    
    checkAndResetNicknames(api).finally(() => {
      if (!stopped) setTimeout(loop, CONFIG.POLL_INTERVAL);
    });
  }

  loop();
  console.log(`🔍 Polling started (${CONFIG.POLL_INTERVAL}ms interval)`);

  return () => { stopped = true; };
}

/**
 * Event listener for instant detection
 */
function startEventListener(api) {
  try {
    api.listenMqtt((err, event) => {
      if (err) return;

      if (event && event.type === "event" && event.logMessageType) {
        const logType = event.logMessageType.toString();
        
        const isNicknameChange = 
          logType === "log:user-nickname" ||
          logType.includes("nickname");

        if (isNicknameChange) {
          const threadId = event.threadID || event.logMessageData?.threadID;
          if (threadId === CONFIG.GROUP_THREAD_ID) {
            console.warn("⚠️ Nickname change detected via events!");
            setTimeout(() => setAllNicknames(api), CONFIG.RESET_DELAY);
          }
        }
      }
    });
    console.log("🎯 Event listener started");
  } catch (error) {
    console.error("❌ Event listener error:", error.message);
  }
}

// 🟢 Facebook Login
login({ appState }, (err, api) => {
  if (err) {
    console.error("❌ Login Failed:", err.message);
    return;
  }

  console.log("✅ Logged in successfully");
  console.log("👨‍💻 Developer: Axshu 🩷");
  console.log(`🔒 Single Nickname: "${CONFIG.LOCKED_NICKNAME}"`);
  console.log(`⏱ Reset Delay: ${CONFIG.RESET_DELAY}ms`);

  // Initialize bot
  loadGroupMembers(api).then(async () => {
    await setAllNicknames(api);
    startPolling(api);
    startEventListener(api);
  }).catch(error => {
    console.error("❌ Initialization failed:", error.message);
  });
});

// ✅ Error handling
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error.message);
});
