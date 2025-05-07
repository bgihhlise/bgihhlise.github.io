// ---- AYARLAR ----
const CORRECT_HASH = "8b71bb7a6af8bb741e14b031176059ec6401bf467d5efb5ca0d2d8640b561c4e";
const SESSION_DURATION_MS = 40 * 60 * 1000; // 40 dakika
const REMEMBER_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 gün

const loginWrapper   = document.getElementById("login-wrapper");
const contentWrapper = document.getElementById("content-wrapper");
const btnLogin       = document.getElementById("btn-login");
const msg            = document.getElementById("msg");
const sessionTimer   = document.getElementById("session-timer");
const logoutBtn      = document.getElementById("logout-btn");
const rememberMe     = document.getElementById("remember-me");
const pwdInput       = document.getElementById("pwd");

let sessionInterval = null;

// --- Hatalı giriş sayaçları ---
let failCount = 0;
let firstFailTime = null;
let lockUntil = null;

// Oturum açık mı? (sayfa yenilense bile)
const sessionExpire = Number(sessionStorage.getItem("sessionExpire"));
if (sessionStorage.getItem("loggedIn") === "true" && sessionExpire && Date.now() < sessionExpire) {
  showContent();
} else {
  clearSession();
}

btnLogin.addEventListener("click", tryLogin);
document.getElementById("pwd").addEventListener("keyup", e=>{
  if (e.key==="Enter") tryLogin();
});
if (logoutBtn) logoutBtn.addEventListener("click", clearSession);

function tryLogin() {
  const now = Date.now();

  // Eğer kilitliyse ve süre dolmadıysa uyarı ver
  if (lockUntil && now < lockUntil) {
    msg.textContent = "Üzülme bir gün sen de gireceksin.";
    return;
  }

  // Kilit süresi geçtiyse sayaçları sıfırla
  if (lockUntil && now >= lockUntil) {
    lockUntil = null;
    failCount = 0;
    firstFailTime = null;
    msg.textContent = "";
  }

  const pwd = document.getElementById("pwd").value;
  if (!pwd) {
    msg.textContent = "Lütfen şifre giriniz!";
    return;
  }

  sha256(pwd).then(hash=>{
    if (hash === CORRECT_HASH) {
      // Beni hatırla seçiliyse süreyi 14 gün yap
      const duration = (rememberMe && rememberMe.checked) ? REMEMBER_DURATION_MS : SESSION_DURATION_MS;
      const expire = Date.now() + duration;
      sessionStorage.setItem("loggedIn","true");
      sessionStorage.setItem("sessionExpire", expire);
      failCount = 0;
      firstFailTime = null;
      lockUntil = null;
      showContent();
    } else {
      // Hatalı giriş işlemleri
      const now = Date.now();
      if (!firstFailTime || now - firstFailTime > 60 * 1000) {
        // 1 dakikadan eskiyse sayaçları sıfırla
        firstFailTime = now;
        failCount = 1;
      } else {
        failCount++;
      }

      if (failCount >= 5) {
        lockUntil = now + 60 * 1000; // 1 dakika kilit
        msg.textContent = "Ağlamak yok.";
      } else {
        msg.textContent = "Hatalı şifre";
      }
    }
  });
}

function showContent() {
  loginWrapper.style.display = "none";
  contentWrapper.style.display = "block";
  fetchAndRenderMarkdown();
  // Sayaç sadece "Beni hatırla" seçili değilse gösterilsin
  if (rememberMe && rememberMe.checked) {
    if (sessionTimer) sessionTimer.style.display = "none";
  } else {
    if (sessionTimer) sessionTimer.style.display = "";
    startSessionTimer();
  }
}

function clearSession() {
  sessionStorage.removeItem("loggedIn");
  sessionStorage.removeItem("sessionExpire");
  if (sessionInterval) clearInterval(sessionInterval);
  if (sessionTimer) sessionTimer.textContent = "";
  if (sessionTimer) sessionTimer.style.display = "";
  loginWrapper.style.display = "block";
  contentWrapper.style.display = "none";
  document.getElementById("pwd").value = "";
  msg.textContent = "";
}

function startSessionTimer() {
  if (!sessionTimer) return;
  if (sessionInterval) clearInterval(sessionInterval);

  function updateTimer() {
    const expire = Number(sessionStorage.getItem("sessionExpire"));
    const now = Date.now();
    let diff = expire - now;
    if (diff <= 0) {
      clearSession();
      return;
    }
    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    sessionTimer.textContent = `${min.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
  }
  updateTimer();
  sessionInterval = setInterval(updateTimer, 1000);
}

// Markdown dosyasını al → HTML'e dönüştür → sayfaya ekle
function fetchAndRenderMarkdown() {
  fetch("content.md")
    .then(r=>r.text())
    .then(md => {
      document.getElementById("markdown-container").innerHTML = marked.parse(md);
      enableCollapsibleSections();
    })
    .catch(err => {
      document.getElementById("markdown-container").innerHTML =
        "<p>İçerik yüklenemedi.</p>";
      console.error(err);
    });
}

// Markdown yüklendikten sonra başlıkları tıklanabilir yap
function enableCollapsibleSections() {
  const container = document.getElementById("markdown-container");
  if (!container) return;

  // Sadece h2 ve h3 başlıklar için uygula
  ["h2", "h3"].forEach(tag => {
    container.querySelectorAll(tag).forEach(header => {
      // Başlığın hemen altındaki kardeşleri topla (bir sonraki başlığa kadar)
      let section = [];
      let el = header.nextElementSibling;
      while (el && !/^H[123]$/.test(el.tagName)) {
        section.push(el);
        el = el.nextElementSibling;
      }
      if (section.length === 0) return;

      // Başlangıçta içeriği gizle
      section.forEach(e => e.style.display = "none");
      header.classList.add("collapsible-header");
      header.classList.add("collapsed");

      // Tıklanınca aç/kapat
      header.addEventListener("click", () => {
        const isCollapsed = header.classList.toggle("collapsed");
        section.forEach(e => e.style.display = isCollapsed ? "none" : "");
      });
    });
  });
}

// ---- SHA‑256 hesaplama ----
async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(hashBuffer)]
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
  }
