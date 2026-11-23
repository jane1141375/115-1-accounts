
    (() => {
      "use strict";

      const STORAGE_KEY = "shiba-ledger-v3";

      // Categories Definition
      const categories = [
        { name: "餐飲", icon: "🍜", color: "#e88b52" },
        { name: "交通", icon: "🚇", color: "#8caa8f" },
        { name: "購物", icon: "🛍️", color: "#91a9bd" },
        { name: "娛樂", icon: "🎧", color: "#b49ab8" },
        { name: "日用品", icon: "🧴", color: "#f4b251" },
        { name: "居住", icon: "🏠", color: "#7b9eb5" },
        { name: "其他", icon: "✨", color: "#c4a3c8" }
      ];
      const icons = Object.fromEntries(categories.map(c => [c.name, c.icon]));

      // Date Utilities
      const today = new Date();
      const dateISO = d => {
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
      };
      const offsetDate = days => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return dateISO(d);
      };
      const formatDate = val => {
        try {
          return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(new Date(val + "T12:00:00"));
        } catch (e) {
          return val;
        }
      };
      const money = val => "$" + Math.round(Number(val) || 0).toLocaleString("zh-TW");
      const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

      // Sound Engine (Web Audio API - Pure native synthesis)
      let audioCtx = null;
      let soundEnabled = true;

      const initAudio = () => {
        if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume();
        }
      };

      const playTone = (freq, type, duration, delay = 0) => {
        if (!soundEnabled) return;
        try {
          initAudio();
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + duration);
        } catch (e) {}
      };

      const playCoinSound = () => {
        playTone(987.77, "sine", 0.09, 0);    // B5
        playTone(1318.51, "sine", 0.22, 0.07); // E6
      };

      const playBarkSound = () => {
        playTone(440, "triangle", 0.08, 0);
        playTone(330, "triangle", 0.12, 0.06);
      };

      const playDeleteSound = () => {
        playTone(220, "sine", 0.15, 0);
      };

      // Default Seed Data
      const seed = () => ({
        budget: 10000, // Monthly flexible living budget
        sound: true,
        affinity: 18,
        transactions: [
          { id: "seed-1", name: "活力早午餐・晨光拿鐵", amount: 155, category: "餐飲", date: offsetDate(-1) },
          { id: "seed-2", name: "捷運悠遊卡自動加值", amount: 200, category: "交通", date: offsetDate(-1) },
          { id: "seed-3", name: "珍珠奶茶大杯微糖", amount: 65, category: "餐飲", date: offsetDate(-2) },
          { id: "seed-4", name: "校園文具小筆記本", amount: 120, category: "購物", date: offsetDate(-3) },
          { id: "seed-5", name: "超商衛生紙日用品", amount: 180, category: "日用品", date: offsetDate(-4) },
          { id: "seed-6", name: "週末朋友聚會披薩", amount: 350, category: "餐飲", date: offsetDate(-5) }
        ]
      });

      // Load State
      const loadState = () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) {
            // Check legacy v2 storage migration
            const oldRaw = localStorage.getItem("shiba-ledger-v2");
            if (oldRaw) {
              const oldData = JSON.parse(oldRaw);
              return {
                ...seed(),
                budget: Number(oldData.budget) || 10000,
                affinity: Number(oldData.affinity) || 18,
                transactions: Array.isArray(oldData.transactions) ? oldData.transactions : seed().transactions
              };
            }
            return seed();
          }
          const parsed = JSON.parse(raw);
          return {
            ...seed(),
            ...parsed,
            budget: Number(parsed.budget) || 10000,
            affinity: Number(parsed.affinity) || 18
          };
        } catch (e) {
          console.error("載入失敗：", e);
          return seed();
        }
      };

      let state = loadState();
      soundEnabled = state.sound !== false;

      const save = () => {
        try {
          state.sound = soundEnabled;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          return true;
        } catch (e) {
          console.error("儲存失敗：", e);
          showToast("⚠️ 儲存失敗，請檢查瀏覽器空間");
          return false;
        }
      };

      // Toast Notifications
      let toastTimer = null;
      const showToast = message => {
        const toast = document.getElementById("toast");
        toast.innerHTML = message;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
      };

      // Calculations Helpers
      const thisMonth = dateStr => dateStr.slice(0, 7) === dateISO(today).slice(0, 7);
      const monthTransactions = () => state.transactions.filter(tx => thisMonth(tx.date));
      const totalSpent = () => monthTransactions().reduce((sum, tx) => sum + Number(tx.amount), 0);
      const categoryTotals = () => Object.fromEntries(
        categories.map(c => [c.name, monthTransactions().filter(tx => tx.category === c.name).reduce((sum, tx) => sum + Number(tx.amount), 0)])
      );

      // Smart Natural Language & Pure Digits Parser
      const parseQuickText = raw => {
        let text = raw.trim();
        if (!text) return null;

        // 1. Pure numbers (e.g. "150", "$150", "150元", "150塊")
        const pureNumMatch = text.match(/^\$?\s*(\d+)\s*(?:元|塊)?$/);
        if (pureNumMatch) {
          return {
            name: "隨手花費",
            amount: parseInt(pureNumMatch[1], 10),
            category: "其他",
            date: dateISO(today)
          };
        }

        // 2. Text with embedded numbers (e.g. "珍奶 65", "午餐便當 120", "65 早餐", "Uber 180元")
        const numMatch = text.match(/(\d+)\s*(?:元|塊)?/);
        if (!numMatch) return null;

        const amount = parseInt(numMatch[1], 10);
        let name = text.replace(numMatch[0], "").replace(/[\$元塊]/g, "").trim();
        if (!name) name = "隨手花費";

        // Auto categorize based on keywords
        let category = "其他";
        if (/餐|飯|麵|早|午|晚|便當|珍奶|奶茶|飲料|拿鐵|咖啡|茶|吃|壽司|火鍋|麵包|蛋|吐司|宵夜|麥當勞|肯德基|subway|吃到飽|零食|下午茶/i.test(name)) {
          category = "餐飲";
        } else if (/車|捷運|公車|計程車|uber|高鐵|火車|悠遊卡|加油|油錢|停車|機車|客運/i.test(name)) {
          category = "交通";
        } else if (/衣服|鞋|包|網購|蝦皮|淘寶|買|飾品|手錶|美妝|藥妝/i.test(name)) {
          category = "購物";
        } else if (/電影|遊戲|ktv|唱歌|展覽|玩具|娛樂|課金|netflix|spotify|disney|漫畫/i.test(name)) {
          category = "娛樂";
        } else if (/衛生紙|洗髮|沐浴|牙膏|超商|7-11|全家|全聯|家樂福|日用|生活用品|洗碗/i.test(name)) {
          category = "日用品";
        } else if (/房租|水費|電費|瓦斯|網路|宿舍|管理費/i.test(name)) {
          category = "居住";
        }

        return { name, amount, category, date: dateISO(today) };
      };

      // Smart Emoji selector based on item name keyword
      const smartEmoji = (name, category) => {
        const n = name.toLowerCase();
        if (/咖啡|latte|拿鐵|美式|cappuccino/.test(n)) return "☕";
        if (/奶茶|珍奶|手搖|飲料|波霸|冬瓜|百香|芋頭|草莓|檸檬茶|冬奶/.test(n)) return "🧋";
        if (/早餐|吐司|蛋餅|饅頭|豆漿|稀飯|燒餅|包子/.test(n)) return "🍳";
        if (/便當|午餐|晚餐|飯|滷肉|雞腿|排骨|池上|自助餐/.test(n)) return "🍱";
        if (/麵|拉麵|烏龍|義大利麵|炒麵|湯麵|冬粉/.test(n)) return "🍜";
        if (/披薩|漢堡|薯條|麥當勞|肯德基|subway|轟炸|雞塊/.test(n)) return "🍔";
        if (/壽司|日式|生魚片|丼飯/.test(n)) return "🍣";
        if (/火鍋|涮涮鍋|麻辣鍋/.test(n)) return "🍲";
        if (/蛋糕|甜點|麵包|可頌|貝果/.test(n)) return "🥐";
        if (/捷運|公車|MRT|地鐵|悠遊|通勤/.test(n)) return "🚇";
        if (/高鐵|火車|台鐵|客運/.test(n)) return "🚆";
        if (/計程車|UBER|油錢|停車|加油/.test(n)) return "🚕";
        if (/購物|網購|蝦皮|衣服|鞋子|包包/.test(n)) return "🛍️";
        if (/電影|KTV|遊戲|展覽|音樂|演唱/.test(n)) return "🎬";
        if (/超商|7-11|全家|萊爾富|ok/.test(n)) return "🏪";
        if (/超市|大潤發|家樂福|全聯|頂好/.test(n)) return "🛒";
        if (/藥妝|屈臣氏|寶雅|洗髮|洗面乳/.test(n)) return "🧴";
        if (/書|文具|筆記/.test(n)) return "📚";
        if (/水費|電費|房租|宿舍|網路|瓦斯/.test(n)) return "🏠";
        if (category === "交通") return "🚇";
        if (category === "購物") return "🛍️";
        if (category === "娛樂") return "🎧";
        if (category === "日用品") return "🧴";
        if (category === "居住") return "🏠";
        if (category === "餐飲") return "🍴";
        return "✨";
      };

      // Top 5 Frequent Items Calculation
      const getFrequentItems = () => {
        const counts = {};
        state.transactions.forEach(tx => {
          const key = `${tx.name}|${tx.amount}|${tx.category}`;
          counts[key] = (counts[key] || 0) + 1;
        });

        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => {
            const [name, amount, category] = k.split("|");
            return { name, amount: Number(amount), category };
          });

        const defaults = [
          { name: "早餐", amount: 65, category: "餐飲" },
          { name: "午餐", amount: 110, category: "餐飲" },
          { name: "手搖飲", amount: 55, category: "餐飲" },
          { name: "咖啡", amount: 85, category: "餐飲" },
          { name: "捷運", amount: 30, category: "交通" }
        ];

        const combined = [...sorted];
        defaults.forEach(d => {
          if (combined.length < 5 && !combined.some(c => c.name === d.name && c.amount === d.amount)) {
            combined.push(d);
          }
        });

        return combined.slice(0, 5);
      };

      const renderQuickCapsules = () => {
        const container = document.getElementById("dynamic-capsules");
        if (!container) return;

        const items = getFrequentItems();
        container.innerHTML = items.map(item => `
          <button class="capsule-item" data-instant="${escapeHTML(item.name)},${item.amount},${escapeHTML(item.category)}" title="點擊直接入帳">
            <span>${smartEmoji(item.name, item.category)}</span>
            <span>${escapeHTML(item.name)}</span>
            <strong style="color:var(--orange-dark);">$${item.amount}</strong>
          </button>
        `).join("");

        // Attach instant click event
        container.querySelectorAll("[data-instant]").forEach(btn => {
          btn.addEventListener("click", () => {
            const [name, amt, cat] = btn.dataset.instant.split(",");
            addTransactionDirect(name, Number(amt), cat);
          });
        });
      };

      // Instant direct booking helper
      const addTransactionDirect = (name, amount, category) => {
        state.transactions.push({
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          amount,
          category,
          date: dateISO(today)
        });
        state.affinity = (state.affinity || 0) + 1;
        if (save()) {
          playCoinSound();
          render();
          showToast(`🐾 已記下「${name}」$${amount}！親密度 +1 ✨`);
        }
      };

      // Shiba Emotional Reactions & Supportive Dialogue
      const updateDogMood = (spent, budget) => {
        const speechEl = document.getElementById("dog-speech");
        const eyesEl = document.getElementById("shiba-eyes");
        const blushL = document.getElementById("blush-left");
        const blushR = document.getElementById("blush-right");

        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const remainingDays = Math.max(1, daysInMonth - today.getDate() + 1);
        const diff = budget - spent;
        const ratio = budget ? spent / budget : 0;

        // Q版大眼常數
        const happyEyes = `
          <ellipse cx="88" cy="98" rx="10" ry="11" fill="#3A2B22"/>
          <ellipse cx="132" cy="98" rx="10" ry="11" fill="#3A2B22"/>
          <circle cx="84" cy="93" r="3.5" fill="#FFFFFF"/>
          <circle cx="128" cy="93" r="3.5" fill="#FFFFFF"/>
          <circle cx="93" cy="101" r="1.5" fill="#FFFFFF" opacity="0.6"/>
          <circle cx="137" cy="101" r="1.5" fill="#FFFFFF" opacity="0.6"/>
          <path d="M82 97 Q88 89 94 97" stroke="#3A2B22" stroke-width="2" stroke-linecap="round" fill="#3A2B22"/>
          <path d="M126 97 Q132 89 138 97" stroke="#3A2B22" stroke-width="2" stroke-linecap="round" fill="#3A2B22"/>`;
        const alertEyes = `
          <ellipse cx="88" cy="98" rx="11" ry="12" fill="#2C2420"/>
          <ellipse cx="132" cy="98" rx="11" ry="12" fill="#2C2420"/>
          <circle cx="84" cy="92" r="3.8" fill="#FFFFFF"/>
          <circle cx="128" cy="92" r="3.8" fill="#FFFFFF"/>
          <circle cx="93" cy="101" r="1.5" fill="#FFFFFF" opacity="0.5"/>
          <circle cx="137" cy="101" r="1.5" fill="#FFFFFF" opacity="0.5"/>`;
        const gentleEyes = `
          <path d="M78 97 Q88 86 98 97" stroke="#2C2420" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <path d="M122 97 Q132 86 142 97" stroke="#2C2420" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <circle cx="84" cy="100" r="2" fill="#2C2420" opacity="0.5"/>
          <circle cx="128" cy="100" r="2" fill="#2C2420" opacity="0.5"/>`;

        if (spent > budget) {
          // Beyond target: Non-judgmental, warm comfort!
          speechEl.textContent = "這個月比較辛苦或聚餐比較多沒關係，我們下個月再一起調整就好汪！錢錢只是變成了生活的美好回憶，不用自責喔！🐾";
          if (eyesEl) eyesEl.innerHTML = gentleEyes;
          if (blushL) blushL.style.fillOpacity = "0.18";
          if (blushR) blushR.style.fillOpacity = "0.18";
        } else if (ratio >= 0.8) {
          // Approaching target: Friendly nudge
          speechEl.textContent = `汪！距離月底還有 ${remainingDays} 天，生活費已使用 ${Math.round(ratio * 100)}%。今天一起散步喝杯溫水，省下一杯手搖好不好汪？☀️`;
          if (eyesEl) eyesEl.innerHTML = alertEyes;
          if (blushL) blushL.style.fillOpacity = "0.32";
          if (blushR) blushR.style.fillOpacity = "0.32";
        } else {
          // Healthy pace: Happy!
          speechEl.textContent = ratio > 0.4 
            ? "汪！花費節奏保持得很舒服喔！今天有好好照顧自己，小柴超級為你高興！🐾" 
            : "汪！錢包很健康，心情也要放輕鬆！想摸摸我的話隨時點擊我喔！✨";
          if (eyesEl) eyesEl.innerHTML = happyEyes;
          if (blushL) blushL.style.fillOpacity = "0.42";
          if (blushR) blushR.style.fillOpacity = "0.42";
        }
      };

      // Petting Interaction
      const petShiba = () => {
        state.affinity = (state.affinity || 0) + 1;
        save();
        playBarkSound();

        // Spawn floating heart
        const avatarWrapper = document.getElementById("shiba-avatar-btn");
        const heart = document.createElement("div");
        heart.className = "floating-heart";
        heart.textContent = ["💖", "🐾", "✨", "💕", "🐕"][Math.floor(Math.random() * 5)];
        heart.style.left = `${50 + (Math.random() * 40 - 20)}%`;
        heart.style.top = `${30 + (Math.random() * 30 - 15)}%`;
        avatarWrapper.appendChild(heart);
        setTimeout(() => heart.remove(), 1000);

        // Pet quotes
        const petQuotes = [
          "（呼嚕呼嚕…）摸摸最舒服了！今天辛苦囉！🥰",
          "汪！親密度升級！小柴會一直在你身邊陪你度過大學生活！🐾",
          "開心到搖尾巴！我們今天也一起省下一點小錢錢！✨",
          "主人的手手好溫暖，有小柴陪你，記帳絕不孤單！🧡",
          "汪嗚～好舒服！記得今天下課也要對自己好一點喔！🐕"
        ];
        document.getElementById("dog-speech").textContent = petQuotes[Math.floor(Math.random() * petQuotes.length)];
        renderAffinity();
        showToast("🐾 摸了摸小柴，好感度 +1！");
      };

      const renderAffinity = () => {
        const aff = state.affinity || 1;
        let levelName = "親密好夥伴";
        if (aff >= 100) levelName = "心靈知己神獸柴";
        else if (aff >= 50) levelName = "形影不離守護柴";
        else if (aff >= 25) levelName = "默契十足好夥伴";

        document.getElementById("affinity-level").textContent = `Lv.${Math.floor(aff / 10) + 1} ${levelName} (${aff}點)`;
      };

      // Charts Rendering
      const renderWeeklyChart = () => {
        const weeklyEl = document.getElementById("weekly-chart");
        if (!weeklyEl) return;

        const days = [];
        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(12, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const k = dateISO(d);
          const total = state.transactions
            .filter(tx => tx.date === k)
            .reduce((s, tx) => s + Number(tx.amount), 0);

          days.push({
            key: k,
            label: new Intl.DateTimeFormat("zh-TW", { weekday: "narrow" }).format(d),
            total,
            isToday: k === dateISO(today)
          });
        }

        const max = Math.max(...days.map(d => d.total), 100);

        weeklyEl.innerHTML = days.map(d => `
          <div class="bar-column">
            <div class="bar-value">${d.total > 0 ? money(d.total) : "—"}</div>
            <div class="bar-track" title="${d.key} 開銷 ${money(d.total)}">
              <div class="bar ${d.isToday ? "today" : ""}" style="height:${Math.max(6, (d.total / max) * 100)}%;"></div>
            </div>
            <div class="bar-label">${d.label}</div>
          </div>
        `).join("");
      };

      const renderDonutChart = (donutId, totalId, legendId) => {
        const totals = categoryTotals();
        const total = Object.values(totals).reduce((a, b) => a + b, 0);
        const chart = document.getElementById(donutId);
        const totalEl = document.getElementById(totalId);
        const legendEl = document.getElementById(legendId);

        if (!chart || !totalEl || !legendEl) return;

        totalEl.textContent = money(total);

        if (total === 0) {
          chart.style.background = "conic-gradient(#eee7dd 0 100%)";
          legendEl.innerHTML = `<div class="section-sub">本月還沒有任何花費紀錄喔 🐾</div>`;
          return;
        }

        let currentAngle = 0;
        const portions = [];
        const activeCategories = categories.filter(c => totals[c.name] > 0);

        activeCategories.forEach(c => {
          const pct = (totals[c.name] / total) * 100;
          const nextAngle = currentAngle + pct;
          portions.push(`${c.color} ${currentAngle}% ${nextAngle}%`);
          currentAngle = nextAngle;
        });

        chart.style.background = `conic-gradient(${portions.join(", ")})`;

        legendEl.innerHTML = activeCategories
          .sort((a, b) => totals[b.name] - totals[a.name])
          .map(c => {
            const pct = Math.round((totals[c.name] / total) * 100);
            return `
              <div class="legend-row">
                <span class="legend-label">
                  <span class="legend-dot" style="background:${c.color}"></span>
                  ${c.name}
                </span>
                <strong>${money(totals[c.name])} (${pct}%)</strong>
              </div>
            `;
          }).join("");
      };

      // Transactions UI Rendering
      const renderTransactions = () => {
        const recentEl = document.getElementById("recent-list");
        const allEl = document.getElementById("all-transactions");
        const query = (document.getElementById("search-transactions")?.value || "").trim().toLowerCase();
        const catFilter = document.getElementById("filter-category")?.value || "";

        const sorted = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

        // 1. Recent (Top 5 this month)
        if (recentEl) {
          const recentList = sorted.filter(tx => thisMonth(tx.date)).slice(0, 5);
          if (recentList.length === 0) {
            recentEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13.5px;">本月還沒有開銷，輸入「珍奶 65」或點常用標籤試試吧 🐾</div>`;
          } else {
            recentEl.innerHTML = recentList.map(tx => `
              <div class="transaction">
                <div class="tx-left">
                  <div class="tx-icon" style="background:${(categories.find(c => c.name === tx.category)?.color || '#e88b52')}18">
                    ${smartEmoji(tx.name, tx.category)}
                  </div>
                  <div class="tx-info">
                    <span class="tx-name">${escapeHTML(tx.name)}</span>
                    <span class="tx-meta">${escapeHTML(tx.category)} · ${formatDate(tx.date)}</span>
                  </div>
                </div>
                <div class="tx-right">
                  <span class="tx-amount">−${money(tx.amount)}</span>
                  <div class="tx-actions">
                    <button class="action-icon-btn edit" data-edit-id="${escapeHTML(tx.id)}" title="編輯修改" aria-label="編輯">✏️</button>
                    <button class="action-icon-btn delete" data-delete-id="${escapeHTML(tx.id)}" title="刪除記錄" aria-label="刪除">✕</button>
                  </div>
                </div>
              </div>
            `).join("");
          }
        }

        // 2. All in Transactions Tab
        if (allEl) {
          const filtered = sorted.filter(tx => {
            const matchQuery = !query || tx.name.toLowerCase().includes(query) || tx.category.toLowerCase().includes(query);
            const matchCat = !catFilter || tx.category === catFilter;
            return matchQuery && matchCat;
          });

          if (filtered.length === 0) {
            allEl.innerHTML = `<div style="text-align:center;padding:36px;color:var(--muted);">找不到符合條件的明細紀錄。</div>`;
          } else {
            allEl.innerHTML = filtered.map(tx => `
              <div class="table-row">
                <div class="table-desc">
                  <span class="tx-icon" style="background:${(categories.find(c => c.name === tx.category)?.color || '#e88b52')}18">
                    ${smartEmoji(tx.name, tx.category)}
                  </span>
                  <span>${escapeHTML(tx.name)}</span>
                </div>
                <div style="color:var(--muted);font-size:13px;">${tx.date} (${formatDate(tx.date)})</div>
                <div><span class="legend-dot" style="display:inline-block;background:${categories.find(c => c.name === tx.category)?.color || '#e88b52'}"></span> ${escapeHTML(tx.category)}</div>
                <div style="text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:10px;">
                  <strong style="font-size:15px;">−${money(tx.amount)}</strong>
                  <button class="action-icon-btn edit" data-edit-id="${escapeHTML(tx.id)}" title="編輯" aria-label="編輯">✏️</button>
                  <button class="action-icon-btn delete" data-delete-id="${escapeHTML(tx.id)}" title="刪除" aria-label="刪除">✕</button>
                </div>
              </div>
            `).join("");
          }
        }
      };

      // Reports View Needs vs Wants
      const renderReports = () => {
        renderDonutChart("report-donut", "report-donut-total", "report-legend");

        const needsWantsEl = document.getElementById("needs-wants");
        if (!needsWantsEl) return;

        const needCategories = new Set(["居住", "交通", "日用品"]);
        const needSum = monthTransactions().filter(tx => needCategories.has(tx.category)).reduce((s, tx) => s + Number(tx.amount), 0);
        const total = totalSpent();
        const wantSum = total - needSum;
        const needPct = total ? Math.round((needSum / total) * 100) : 0;

        needsWantsEl.innerHTML = `
          <div style="margin-bottom:16px;">
            <div class="legend-row">
              <span class="legend-label"><span class="legend-dot" style="background:var(--sage)"></span>日常必需（房租、交通、生活用品）</span>
              <strong>${money(needSum)} (${needPct}%)</strong>
            </div>
            <div class="progress-track" style="margin-top:6px;height:9px;">
              <div class="progress-fill" style="width:${needPct}%;background:var(--sage)"></div>
            </div>
          </div>
          <div>
            <div class="legend-row">
              <span class="legend-label"><span class="legend-dot" style="background:var(--orange)"></span>生活小確幸（美食聚餐、娛樂購物）</span>
              <strong>${money(wantSum)} (${100 - needPct}%)</strong>
            </div>
            <div class="progress-track" style="margin-top:6px;height:9px;">
              <div class="progress-fill" style="width:${100 - needPct}%;background:var(--orange)"></div>
            </div>
          </div>
        `;
      };

      // Main Render Coordinator
      const render = () => {
        const spent = totalSpent();
        const budget = Number(state.budget) || 10000;
        const left = budget - spent;
        const ratio = budget ? spent / budget : 0;

        // Topbar
        const hr = today.getHours();
        document.getElementById("greeting").textContent = hr < 11 ? "早安，今天也辛苦了 ☀️" : hr < 18 ? "午後好，適時喝杯水休息一下 🌤️" : "晚安，今天也辛苦了 🌙";
        document.getElementById("today-date").textContent = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(today);

        // Days remaining in this month
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const remainingDays = Math.max(1, daysInMonth - today.getDate() + 1);

        // Daily Safe Allowance
        const dailySafe = Math.round(Math.max(0, left) / remainingDays);
        document.getElementById("daily-allowance-val").textContent = money(dailySafe);
        document.getElementById("days-countdown-tag").textContent = `本月還剩 ${remainingDays} 天`;
        
        const dailyNoteEl = document.getElementById("daily-allowance-note");
        if (left >= 0) {
          dailyNoteEl.textContent = `距離月底還有 ${remainingDays} 天，每天還能安心自由花 ${money(dailySafe)}，無痛掌控生活節奏。`;
        } else {
          dailyNoteEl.innerHTML = `已稍微超出預算 ${money(-left)}。沒關係，點下方「＋500 放寬一點」微調，或是放慢步調慢慢平衡就好汪！`;
        }

        // Monthly Flexible Living Budget
        document.getElementById("monthly-budget-val").textContent = money(budget);
        document.getElementById("monthly-spent-ratio").textContent = `（已支用 ${Math.round(ratio * 100)}%）`;
        document.getElementById("dashboard-spent-val").textContent = money(spent);

        const progressFill = document.getElementById("dashboard-progress-fill");
        progressFill.style.width = `${Math.min(100, ratio * 100)}%`;
        progressFill.style.background = ratio > 1 ? "#e88b52" : ratio > 0.8 ? "var(--yellow)" : "var(--sage)";

        const statusLabel = document.getElementById("dashboard-status-label");
        if (left < 0) {
          statusLabel.innerHTML = `稍微超出目標 ${money(-left)}（可隨時微調）`;
        } else {
          statusLabel.innerHTML = `還剩 ${money(left)} 可支配`;
        }

        // Sidebar Mini Widget
        document.getElementById("mini-remaining").textContent = left >= 0 ? `本月還可花：${money(left)}` : `超出目標 ${money(-left)}`;
        document.getElementById("mini-pct").textContent = `${Math.round(ratio * 100)}%`;
        document.getElementById("mini-fill").style.width = `${Math.min(100, ratio * 100)}%`;
        document.getElementById("mini-fill").style.background = ratio > 1 ? "var(--orange)" : "var(--orange-gradient)";
        document.getElementById("mini-note").textContent = `目標生活費 ${money(budget)} · 剩 ${remainingDays} 天`;

        // Allowance View input sync
        const view3Input = document.getElementById("allowance-input-field");
        if (view3Input) view3Input.value = budget;

        // Shiba tips
        const totals = categoryTotals();
        const topCat = categories.reduce((max, c) => totals[c.name] > totals[max.name] ? c : max, categories[0]);
        let tip = "生活本就起起伏伏，按自己的舒服節奏過日子就好汪！每一筆記錄都是在溫柔照顧自己。";
        if (totals[topCat.name] > 0) {
          tip = `本月開銷目前最多的是「${topCat.name}」（${money(totals[topCat.name])}）。有誠實記下來就很棒，阿柴為你的自律鼓掌！🐾`;
        }
        document.getElementById("saving-tip").textContent = tip;
        document.getElementById("report-tip").textContent = tip;

        updateDogMood(spent, budget);
        renderQuickCapsules();
        renderWeeklyChart();
        renderDonutChart("donut", "donut-total", "category-legend");
        renderTransactions();
        renderReports();
        renderAffinity();
      };

      // Lazy Quick Form Submit (一句話懶人快記)
      const lazyForm = document.getElementById("lazy-quick-form");
      const lazyInput = document.getElementById("lazy-quick-input");

      lazyForm.addEventListener("submit", e => {
        e.preventDefault();
        const parsed = parseQuickText(lazyInput.value);
        if (!parsed) {
          showToast("⚠️ 請輸入內容，例如「珍奶 65」或直接打數字「120」");
          return;
        }

        addTransactionDirect(parsed.name, parsed.amount, parsed.category);
        lazyInput.value = "";
      });

      // Quick Adjust Buttons Handlers
      const adjustBudget = delta => {
        state.budget = Math.max(500, (Number(state.budget) || 10000) + delta);
        if (save()) {
          playCoinSound();
          render();
          const sign = delta > 0 ? "放寬" : "下修";
          showToast(`🐾 已為你${sign} $${Math.abs(delta)} 生活費！享受當下、好好生活 ✨`);
        }
      };

      document.getElementById("btn-adjust-plus500").addEventListener("click", () => adjustBudget(500));
      document.getElementById("btn-adjust-minus500").addEventListener("click", () => adjustBudget(-500));
      document.getElementById("btn-adjust-plus1000").addEventListener("click", () => adjustBudget(1000));

      document.getElementById("view3-adjust-plus500").addEventListener("click", () => adjustBudget(500));
      document.getElementById("view3-adjust-minus500").addEventListener("click", () => adjustBudget(-500));
      document.getElementById("view3-adjust-plus1000").addEventListener("click", () => adjustBudget(1000));
      document.getElementById("view3-adjust-reset").addEventListener("click", () => {
        state.budget = 10000;
        save();
        render();
        showToast("🐾 生活費目標已設為 10,000 元標竿！");
      });

      document.getElementById("save-allowance-btn").addEventListener("click", () => {
        const val = Number(document.getElementById("allowance-input-field").value);
        if (val > 0) {
          state.budget = val;
          save();
          render();
          showToast(`💾 生活費目標已更新為 ${money(val)}！`);
        }
      });

      document.getElementById("edit-budget-direct-btn").addEventListener("click", () => {
        const current = Number(state.budget) || 10000;
        const input = prompt("請輸入本月預計的生活費總額度 (NT$)：", current);
        if (input !== null) {
          const val = parseInt(input, 10);
          if (val > 0) {
            state.budget = val;
            save();
            render();
            showToast(`💾 本月生活費已調整為 ${money(val)}！`);
          }
        }
      });

      // Voice Input Setup
      const initVoice = () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const voiceBtn = document.getElementById("voice-input");
        if (!voiceBtn) return;

        if (!SpeechRec) {
          // Browser doesn't support speech recognition at all
          voiceBtn.addEventListener("click", () => {
            showToast("🐾 目前環境不支援語音，直接打字或點快捷鍵也很快汪！");
          });
          voiceBtn.title = "目前瀏覽器不支援語音辨識";
          return;
        }

        const recognition = new SpeechRec();
        recognition.lang = "zh-TW";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceBtn.addEventListener("click", () => {
          initAudio();
          voiceBtn.disabled = true;
          voiceBtn.innerHTML = "<span>🎧 聆聽中…</span>";
          try {
            recognition.start();
          } catch (e) {
            voiceBtn.disabled = false;
            voiceBtn.innerHTML = "<span>🎙️ 說一句</span>";
            showToast("🐾 無法啟動語音，直接打字或點快捷鍵也很快汪！");
          }
        });

        recognition.onresult = event => {
          const text = event.results[0][0].transcript;
          lazyInput.value = text;
          const parsed = parseQuickText(text);
          if (parsed) {
            addTransactionDirect(parsed.name, parsed.amount, parsed.category);
            lazyInput.value = "";
          } else {
            showToast(`🎙️ 聽到「${text}」，已為你填入快記框！`);
          }
        };

        recognition.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "permission-denied") {
            showToast("🎙️ 麥克風權限未開啟，請在瀏覽器設定中允許麥克風汪！");
          } else if (event.error === "no-speech") {
            showToast("🐾 好像沒聽到聲音，再說一次或直接打字也可以喔！");
          } else {
            showToast("🐾 目前環境不支援語音，直接打字或點快捷鍵也很快汪！");
          }
        };

        recognition.onend = () => {
          voiceBtn.disabled = false;
          voiceBtn.innerHTML = "<span>🎙️ 說一句</span>";
        };
      };

      // Ask Shiba Emotional Dialogue
      document.querySelectorAll("[data-ask]").forEach(btn => {
        btn.addEventListener("click", () => {
          const type = btn.dataset.ask;
          const speechEl = document.getElementById("dog-speech");
          const left = state.budget - totalSpent();

          playBarkSound();
          if (type === "boba") {
            speechEl.textContent = left > 2000 
              ? "汪！點杯微糖少冰犒賞自己一下很可以！喝完心情好，讀書工作都更有動力汪！🧋" 
              : "錢包有點吃緊囉！小柴泡溫開水給你喝，少買這杯，月底就能多吃一顆溫泉蛋！🐾";
          } else if (type === "reward") {
            speechEl.textContent = "想犒賞自己？先把商品加進購物車，等明早起床如果還是很心動，再把它買回家！冷靜期能幫你省下一半衝動消費！🎁";
          } else if (type === "anxious") {
            speechEl.textContent = "別慌別慌，有小柴在！我們一起看「每日安心花額度」，只要接下來幾天自己煮個簡單麵條，就能平安過好這個月！✨";
          } else if (type === "worth") {
            speechEl.textContent = "問自己三個問題：我需要它嗎？我一年內會用五次以上嗎？沒買我明天會難過嗎？如果都是否，那就先省下來吧！🐕";
          }
        });
      });

      // View Switching System
      const navButtons = document.querySelectorAll("[data-view]");
      const views = document.querySelectorAll(".view");

      const switchView = viewName => {
        navButtons.forEach(btn => {
          btn.classList.toggle("active", btn.dataset.view === viewName);
        });
        views.forEach(v => {
          v.classList.toggle("active", v.id === `view-${viewName}`);
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      navButtons.forEach(btn => {
        btn.addEventListener("click", () => switchView(btn.dataset.view));
      });

      document.querySelectorAll("[data-goto]").forEach(btn => {
        btn.addEventListener("click", () => switchView(btn.dataset.goto));
      });

      // Detailed Modal Handling (For Edit and Custom Add)
      const modal = document.getElementById("transaction-modal");
      const form = document.getElementById("transaction-form");
      const modalTitle = document.getElementById("modal-title");
      const editIdInput = document.getElementById("tx-edit-id");

      const openModal = (txToEdit = null) => {
        initAudio();
        if (txToEdit) {
          modalTitle.textContent = "修改記帳紀錄";
          editIdInput.value = txToEdit.id;
          document.getElementById("tx-name").value = txToEdit.name;
          document.getElementById("tx-amount").value = txToEdit.amount;
          document.getElementById("tx-category").value = txToEdit.category;
          document.getElementById("tx-date").value = txToEdit.date;
          document.getElementById("modal-submit-btn").innerHTML = "<span>確認修改 ✦</span>";
        } else {
          modalTitle.textContent = "詳細記下一筆";
          editIdInput.value = "";
          form.reset();
          document.getElementById("tx-date").value = dateISO(today);
          document.getElementById("modal-submit-btn").innerHTML = "<span>收進帳本 ✦</span>";
        }
        modal.classList.add("open");
        document.getElementById("tx-name").focus();
      };

      const closeModal = () => {
        modal.classList.remove("open");
        form.reset();
        editIdInput.value = "";
      };

      document.getElementById("open-add-modal-btn")?.addEventListener("click", () => openModal());
      document.getElementById("close-modal").addEventListener("click", closeModal);
      document.getElementById("cancel-modal").addEventListener("click", closeModal);
      modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && modal.classList.contains("open")) {
          closeModal();
        }
      });

      form.addEventListener("submit", e => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get("name")).trim();
        const amount = Number(fd.get("amount"));
        const category = String(fd.get("category"));
        const date = String(fd.get("date"));
        const editId = editIdInput.value;

        if (!name || !amount || amount <= 0 || !date) {
          showToast("⚠️ 請確認名稱、金額與日期皆填寫正確");
          return;
        }

        if (editId) {
          const idx = state.transactions.findIndex(t => t.id === editId);
          if (idx !== -1) {
            state.transactions[idx] = { id: editId, name, amount, category, date };
            showToast("✏️ 紀錄已成功更新！");
          }
        } else {
          state.transactions.push({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            amount,
            category,
            date
          });
          playCoinSound();
          showToast("🐾 記下來了！小柴替你收好這筆花費 ✦");
        }

        if (save()) {
          closeModal();
          render();
        }
      });

      // Transaction Actions (Edit / Delete)
      const handleTxActions = e => {
        const editBtn = e.target.closest("[data-edit-id]");
        if (editBtn) {
          const tx = state.transactions.find(t => t.id === editBtn.dataset.editId);
          if (tx) openModal(tx);
          return;
        }

        const delBtn = e.target.closest("[data-delete-id]");
        if (delBtn) {
          const txId = delBtn.dataset.deleteId;
          const tx = state.transactions.find(t => t.id === txId);
          if (!tx) return;

          if (confirm(`確定要刪除「${tx.name}」這筆記錄嗎？`)) {
            state.transactions = state.transactions.filter(t => t.id !== txId);
            playDeleteSound();
            save();
            render();
            showToast("🗑️ 已成功移除該筆記錄");
          }
        }
      };

      document.getElementById("recent-list").addEventListener("click", handleTxActions);
      document.getElementById("all-transactions").addEventListener("click", handleTxActions);

      // Search & Filter
      document.getElementById("search-transactions")?.addEventListener("input", renderTransactions);
      document.getElementById("filter-category")?.addEventListener("change", renderTransactions);

      // Pet Button
      document.getElementById("shiba-avatar-btn").addEventListener("click", petShiba);
      document.getElementById("sidebar-affinity-btn").addEventListener("click", petShiba);

      // Sound Toggle
      const toggleSound = () => {
        soundEnabled = !soundEnabled;
        state.sound = soundEnabled;
        save();
        document.getElementById("sound-status-icon").textContent = soundEnabled ? "🔊 開啟" : "🔇 靜音";
        showToast(soundEnabled ? "🔊 音效已開啟" : "🔇 已切換為靜音模式");
        if (soundEnabled) playCoinSound();
      };
      document.getElementById("sound-toggle-btn").addEventListener("click", toggleSound);
      document.getElementById("sound-toggle-btn2")?.addEventListener("click", toggleSound);

      // Export CSV (Excel compatible with UTF-8 BOM)
      const exportCSV = () => {
        if (!state.transactions.length) {
          showToast("⚠️ 目前沒有任何紀錄可匯出喔");
          return;
        }

        const headers = ["交易編號", "品項名稱", "消費金額", "生活類別", "日期"];
        const rows = state.transactions.map(t => [
          `"${t.id}"`,
          `"${t.name.replace(/"/g, '""')}"`,
          t.amount,
          `"${t.category}"`,
          `"${t.date}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `柴柴生活記帳_匯出_${dateISO(today)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("📊 CSV 試算表檔案已開始下載！");
      };

      document.getElementById("export-csv-btn")?.addEventListener("click", exportCSV);
      document.getElementById("export-csv-btn2")?.addEventListener("click", exportCSV);

      // Backup JSON
      document.getElementById("backup-json-btn")?.addEventListener("click", () => {
        const jsonStr = JSON.stringify(state, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shiba_lifestyle_ledger_${dateISO(today)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("💾 完整 JSON 備份檔已下載！");
      });

      // Restore JSON
      document.getElementById("import-json-input")?.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = evt => {
          try {
            const data = JSON.parse(evt.target.result);
            if (!data || !Array.isArray(data.transactions) || typeof data.budget !== "number") {
              throw new Error("格式不符合柴柴帳本標準");
            }
            if (confirm(`確定要匯入此備份嗎？包含 ${data.transactions.length} 筆明細，將覆蓋現有資料。`)) {
              state = { ...seed(), ...data };
              save();
              render();
              showToast(`🎉 成功還原 ${data.transactions.length} 筆生活開銷！`);
            }
          } catch (err) {
            alert("匯入失敗：檔案損壞或格式不符合。");
          }
        };
        reader.readAsText(file);
      });

      // Reset Data
      document.getElementById("reset-data")?.addEventListener("click", () => {
        if (confirm("⚠️ 警告：確定清除本機所有記帳與生活費資料嗎？此操作無法撤銷！")) {
          localStorage.removeItem(STORAGE_KEY);
          state = seed();
          save();
          render();
          showToast("🔄 帳本已重設為全新起始狀態");
        }
      });

      // Init
      initVoice();
      render();
    })();
  