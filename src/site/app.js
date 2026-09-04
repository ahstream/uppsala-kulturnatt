const DATA_PATH = '/data/packedEvents.json';
const FIREBASE_SCRIPT_URLS = ['https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth-compat.js', 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore-compat.js'];
let debugEnabled = new URL(window.location.href).searchParams.get('debug') === 'true';

const $header = document.querySelector('header');
const $status = document.getElementById('status');
const $activeTabHeading = document.getElementById('active-tab-heading');
const $programSortControls = document.getElementById('program-sort-controls');
const $programSortStart = document.getElementById('program-sort-start');
const $programSortSeen = document.getElementById('program-sort-seen');
const $infoButton = document.getElementById('info-button');
const $infoDialog = document.getElementById('info-dialog');
const $infoClose = document.getElementById('info-close');
const $finishedVisibilityToggle = document.getElementById('finished-visibility-toggle');
const $themeToggle = document.getElementById('theme-toggle');
const $loginButton = document.getElementById('login-button');
const $userMenu = document.getElementById('user-menu');
const $logoutButton = document.getElementById('logout-button');
const $syncAlert = document.getElementById('sync-alert');
const $syncLoginLink = document.getElementById('sync-login-link');
const $authDialog = document.getElementById('auth-dialog');
const $authForm = document.getElementById('auth-form');
const $authEmail = document.getElementById('auth-email');
const $authPassword = document.getElementById('auth-password');
const $authMessage = document.getElementById('auth-message');
const $googleLoginButton = document.getElementById('google-login-button');
const $authClose = document.querySelector('.auth-close');
const $list = document.getElementById('list');
const $search = document.getElementById('event-search');
const $clearFilters = document.getElementById('clear-filters');
const $childrenFilter = document.getElementById('children-filter');
const $adultsFilter = document.getElementById('adults-filter');
const $freeFilter = document.getElementById('free-filter');
const $paidFilter = document.getElementById('paid-filter');
const $fromFilter = document.getElementById('from-filter');
const $toFilter = document.getElementById('to-filter');
const $showFilters = document.getElementById('show-filters');
const $showFiltersLabel = document.getElementById('show-filters-label');
const $filterSearchSection = document.getElementById('filter-search-section');
const $closeFilters = document.getElementById('close-filters');
const $closeFiltersBottom = document.getElementById('close-filters-bottom');
const $filterCount = document.getElementById('filter-count');
const $selectedFilters = document.getElementById('selected-filters');
const $tabSelect = document.getElementById('tab-select');
const tabs = {
  program: document.getElementById('tab-program'),
  cancelled: document.getElementById('tab-cancelled'),
  favorites: document.getElementById('tab-favorites'),
  live: document.getElementById('tab-live'),
  recent: document.getElementById('tab-recent'),
  soon: document.getElementById('tab-soon'),
  later: document.getElementById('tab-later'),
  finished: document.getElementById('tab-finished'),
  unfinished: document.getElementById('tab-unfinished'),
};

function updateDebugMode() {
  debugEnabled = new URL(window.location.href).searchParams.get('debug') === 'true';
}

const multiFilters = [
  { menu: document.getElementById('category-menu'), options: document.getElementById('category-options'), summary: document.getElementById('category-summary'), eventProperty: 'categoryNames', allLabel: 'Alla kategorier', selectedLabel: 'categories' },
  { menu: document.getElementById('language-menu'), options: document.getElementById('language-options'), summary: document.getElementById('language-summary'), eventProperty: 'languageNames', allLabel: 'Alla språk', selectedLabel: 'languages' },
  { menu: document.getElementById('location-menu'), options: document.getElementById('location-options'), summary: document.getElementById('location-summary'), eventProperty: 'locationNames', allLabel: 'Alla platser', selectedLabel: 'locations' },
  { menu: document.getElementById('accessibility-menu'), options: document.getElementById('accessibility-options'), summary: document.getElementById('accessibility-summary'), eventProperty: 'accessibilityNames', allLabel: 'All tillgänglighet', selectedLabel: 'accessibilities' },
];

let allEvents = [];
let activeTab = 'program';
let programSortMode = 'start';
let hideFinishedEvents = false;
let firebaseAuth = null;
let firebaseUser = null;
let firebaseInitializationPromise = null;
let settingsDocument = null;
let cloudSyncTimer = null;
updateDebugMode();
const RECENT_EVENT_WINDOW_MS = 15 * 60 * 1000;
const SOON_EVENT_WINDOW_MS = 45 * 60 * 1000;

window.addEventListener('pageshow', updateDebugMode);

function setTheme(theme, persist = true) {
  document.body.dataset.theme = theme;
  if (persist) localStorage.setItem('theme', theme);
  const isLight = theme === 'light';
  $themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-moon" aria-hidden="true"></i>' : '<i class="fa-solid fa-sun" aria-hidden="true"></i>';
  const label = isLight ? 'Byt till mörkt läge' : 'Byt till ljust läge';
  $themeToggle.setAttribute('aria-label', label);
  $themeToggle.title = label;
  if (persist) scheduleCloudSettingsSync();
}

const savedTheme = localStorage.getItem('theme');
const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
setTheme(initialTheme, false);
hideFinishedEvents = localStorage.getItem('hideFinishedEvents') === 'true';

function eventStartTime(event) {
  if (Number.isFinite(event.startMs)) return event.startMs;
  return new Date(event.start || event.startTime || 0).getTime();
}

function eventAssumedDuration(event) {
  return event.type === 'subEvent' ? 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
}

function eventEndTime(event) {
  if (Number.isFinite(event.endMs)) return event.endMs;
  if (event.end || event.endTime) return new Date(event.end || event.endTime).getTime();

  const startTime = eventStartTime(event);
  return Number.isFinite(startTime) ? startTime + eventAssumedDuration(event) : NaN;
}

function isFinishedEvent(event, currentTime = eventCurrentTime()) {
  const endTime = eventEndTime(event);
  return !event.isCancelled && Number.isFinite(endTime) && endTime < currentTime;
}

function visibleByFinishedToggle(events, tab, currentTime) {
  if (!hideFinishedEvents) return events;
  return events.filter((event) => !isFinishedEvent(event, currentTime));
}

function updateFinishedVisibilityToggle() {
  const label = hideFinishedEvents ? 'Visa avslutade evenemang' : 'Dölj avslutade evenemang';
  $finishedVisibilityToggle.innerHTML = hideFinishedEvents ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>' : '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
  $finishedVisibilityToggle.setAttribute('aria-label', label);
  $finishedVisibilityToggle.setAttribute('aria-pressed', String(hideFinishedEvents));
  $finishedVisibilityToggle.title = label;
}

function eventCurrentTime() {
  if (typeof FAKE_TODAY_DATE !== 'string') return Date.now();
  const match = FAKE_TODAY_DATE.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Date.now();

  const now = new Date();
  const fakeNow = new Date(now);
  fakeNow.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return fakeNow.getTime();
}

function populateHourFilter(select) {
  for (let hour = 0; hour < 24; hour += 1) {
    const option = document.createElement('option');
    option.value = String(hour).padStart(2, '0');
    option.textContent = option.value;
    select.appendChild(option);
  }
}

function numericSortValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

function compareByStartTime(firstEvent, secondEvent) {
  const sortKeyDiff = numericSortValue(firstEvent.sortKeyTime) - numericSortValue(secondEvent.sortKeyTime);
  if (sortKeyDiff !== 0) return sortKeyDiff;

  const startDiff = eventStartTime(firstEvent) - eventStartTime(secondEvent);
  if (startDiff !== 0) return startDiff;

  const endDiff = eventEndTime(firstEvent) - eventEndTime(secondEvent);
  if (endDiff !== 0) return endDiff;

  return String(firstEvent.title || firstEvent.name || '').localeCompare(String(secondEvent.title || secondEvent.name || ''), 'sv-SE');
}

function compareByUpdatedSortKey(firstEvent, secondEvent) {
  const sortKeyDiff = numericSortValue(firstEvent.sortKeyUpdated) - numericSortValue(secondEvent.sortKeyUpdated);
  return sortKeyDiff || compareByStartTime(firstEvent, secondEvent);
}

function sortProgramEvents(events) {
  return events.slice().sort(programSortMode === 'updated' ? compareByUpdatedSortKey : compareByStartTime);
}

function updateProgramSortControls() {
  const sortingByStart = programSortMode === 'start';
  $programSortStart.classList.toggle('active', sortingByStart);
  $programSortStart.setAttribute('aria-pressed', String(sortingByStart));
  $programSortSeen.classList.toggle('active', !sortingByStart);
  $programSortSeen.setAttribute('aria-pressed', String(!sortingByStart));
}

function eventsInWindow(events, fromTime, toTime) {
  return events.filter((event) => {
    if (event.isCancelled) return false;
    const startTime = eventStartTime(event);
    return Number.isFinite(startTime) && startTime >= fromTime && startTime <= toTime;
  });
}

function laterEvents(events, fromTime) {
  return events.filter((event) => {
    if (event.isCancelled) return false;
    const startTime = eventStartTime(event);
    return Number.isFinite(startTime) && startTime > fromTime;
  });
}

function tabTooltip(tab) {
  return tabs[tab].title.replace(/\s*\([^)]*\)\s*$/, '');
}

function tabIcon(tab) {
  return tabs[tab].textContent.trim().split(/\s+/)[0];
}

function liveEvents(events, currentTime) {
  return events.filter((event) => {
    if (event.isCancelled) return false;
    const startTime = eventStartTime(event);
    const endTime = eventEndTime(event);
    return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime <= currentTime && endTime >= currentTime;
  });
}

function formatLocalClockTime(value) {
  if (!value && value !== 0) return '—';

  const raw = String(value).trim();
  if (!raw) return '—';

  const simpleMatch = raw.match(/^(\d{1,2})[:.](\d{2})$/);
  if (simpleMatch) {
    return `${String(simpleMatch[1]).padStart(2, '0')}:${String(simpleMatch[2]).padStart(2, '0')}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    if (hour && minute) return `${hour}:${minute}`;
  } catch (err) {
    // ignore and fall back to the raw value below
  }

  return raw;
}

function formatLocalDateTime(value) {
  if (!value && value !== 0) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatUpdatedStatus(event) {
  const updated = formatLocalDateTime(event.updated);
  if (!updated) return null;

  const rawUpdateStatus = typeof event.updateStatus === 'string' ? event.updateStatus.trim() : '';
  const updateStatus = rawUpdateStatus === 'new' || rawUpdateStatus === 'created' ? 'Skapad' : rawUpdateStatus === 'updated' ? 'Ändrad' : rawUpdateStatus;
  return `Uppdaterad: ${updated}${updateStatus ? ` (${updateStatus})` : ''}`;
}

function idFor(e) {
  return e.id || e.externalId || e.value || e.eventId || JSON.stringify(e).slice(0, 8);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem('favorites');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveFavorites(arr) {
  localStorage.setItem('favorites', JSON.stringify(arr));
  scheduleCloudSettingsSync();
}

function setStatus(message = '') {
  $status.textContent = message;
  $status.hidden = !message;
}

function normalizeEvent(event) {
  event.favoriteId = idFor(event);
  event.startMs = eventStartTime(event);
  event.endMs = eventEndTime(event);
  event.startMinutes = clockMinutes(event.start || event.startTime || event.startTimeText || event.time);
  event.endMinutes = eventEndClockMinutes(event);
  event.searchText = [event.title, event.name, event.displayName, event.locationAlias, event.locationName, event.location].map((value) => String(value ?? '').toLocaleLowerCase('sv-SE')).join(' ');
  return event;
}

function localSettings() {
  return {
    theme: document.body.dataset.theme,
    favorites: loadFavorites(),
    hideFinishedEvents,
  };
}

function applySettings(settings) {
  if (settings && (settings.theme === 'light' || settings.theme === 'dark')) setTheme(settings.theme, false);
  if (settings && Array.isArray(settings.favorites)) localStorage.setItem('favorites', JSON.stringify(settings.favorites));
  if (settings && typeof settings.hideFinishedEvents === 'boolean') {
    hideFinishedEvents = settings.hideFinishedEvents;
    localStorage.setItem('hideFinishedEvents', String(hideFinishedEvents));
  }
  updateFinishedVisibilityToggle();
}

function scheduleCloudSettingsSync() {
  if (!settingsDocument) return;
  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(() => {
    settingsDocument.set(localSettings(), { merge: true }).catch((error) => {
      console.error('Firebase settings sync failed:', error);
      setStatus('Inställningarna kunde inte synkroniseras till Firebase.');
    });
  }, 300);
}

async function syncSettingsWithFirebase() {
  if (!settingsDocument) return;
  try {
    const snapshot = await settingsDocument.get();
    const local = localSettings();
    const remote = snapshot.exists ? snapshot.data() : null;
    if (remote) {
      applySettings({
        ...remote,
        favorites: [...new Set([...(Array.isArray(remote.favorites) ? remote.favorites : []), ...local.favorites])],
      });
    }
    await settingsDocument.set(localSettings(), { merge: true });
    updateTabCounts();
    setActive(activeTab);
  } catch (error) {
    console.error('Firebase settings sync failed:', error);
    setStatus('Inställningarna kunde inte synkroniseras till Firebase.');
  }
}

function showAuthMessage(message = '') {
  $authMessage.textContent = message;
}

function openAuthenticationDialog() {
  showAuthMessage();
  $authForm.reset();
  $authDialog.showModal();
  requestAnimationFrame(() => $googleLoginButton.focus());
}

function updateAuthenticationUi(user) {
  firebaseUser = user;
  $syncAlert.hidden = Boolean(user);
  $userMenu.hidden = true;
  $loginButton.setAttribute('aria-expanded', 'false');
  $loginButton.replaceChildren();
  if (!user) {
    $loginButton.setAttribute('aria-label', 'Logga in');
    $loginButton.title = 'Logga in';
    $loginButton.append(Object.assign(document.createElement('i'), { className: 'fa-regular fa-user', ariaHidden: 'true' }));
    return;
  }

  $loginButton.setAttribute('aria-label', `Konto: ${user.displayName || user.email || 'användare'}`);
  $loginButton.title = `Inloggad som ${user.displayName || user.email || 'användare'}`;
  if (user.photoURL) {
    const image = document.createElement('img');
    image.className = 'user-avatar';
    image.src = user.photoURL;
    image.alt = '';
    $loginButton.append(image);
  } else {
    $loginButton.append(Object.assign(document.createElement('i'), { className: 'fa-solid fa-user-check', ariaHidden: 'true' }));
  }
}

function loadScript(src) {
  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function initFirebaseAuthentication() {
  if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG) {
    $loginButton.disabled = true;
    $loginButton.title = 'Firebase är inte konfigurerat';
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    const database = firebase.firestore();
    firebaseAuth.onAuthStateChanged(async (user) => {
      updateAuthenticationUi(user);
      settingsDocument = user ? database.collection('users').doc(user.uid) : null;
      if (user) await syncSettingsWithFirebase();
    });
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    $loginButton.disabled = true;
    $loginButton.title = 'Firebase kunde inte startas';
  }
}

async function ensureFirebaseAuthentication() {
  if (firebaseAuth) return true;
  if (!firebaseInitializationPromise) {
    firebaseInitializationPromise = FIREBASE_SCRIPT_URLS.reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve()).then(() => initFirebaseAuthentication());
  }

  try {
    await firebaseInitializationPromise;
  } catch (error) {
    console.error('Firebase scripts failed to load:', error);
    $loginButton.disabled = true;
    $loginButton.title = 'Firebase kunde inte laddas';
  }
  return Boolean(firebaseAuth);
}

function scheduleFirebaseIdleLoad() {
  const loadFirebase = () => ensureFirebaseAuthentication();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadFirebase, { timeout: 3000 });
  } else {
    window.setTimeout(loadFirebase, 1500);
  }
}

function updateTabCounts() {
  const favorites = loadFavorites();
  const favoriteIds = new Set(favorites);
  const now = eventCurrentTime();
  let activeCount = 0;
  let cancelledCount = 0;
  let favoriteCount = 0;
  let liveCount = 0;
  let recentCount = 0;
  let soonCount = 0;
  let laterCount = 0;
  let finishedCount = 0;
  let unfinishedCount = 0;

  for (const event of allEvents) {
    const isCancelled = Boolean(event.isCancelled);
    const isFinished = isFinishedEvent(event, now);
    if (isCancelled) cancelledCount += 1;
    if (isFinished) finishedCount += 1;
    if (!isCancelled && !isFinished) unfinishedCount += 1;

    if (hideFinishedEvents && isFinished) continue;
    if (!isCancelled) activeCount += 1;
    if (favoriteIds.has(event.favoriteId)) favoriteCount += 1;
    if (!isCancelled && Number.isFinite(event.startMs) && Number.isFinite(event.endMs) && event.startMs <= now && event.endMs >= now) liveCount += 1;
    if (!isCancelled && Number.isFinite(event.startMs) && event.startMs >= now - RECENT_EVENT_WINDOW_MS && event.startMs <= now) recentCount += 1;
    if (!isCancelled && Number.isFinite(event.startMs) && event.startMs >= now && event.startMs <= now + SOON_EVENT_WINDOW_MS) soonCount += 1;
    if (!isCancelled && Number.isFinite(event.startMs) && event.startMs > now + SOON_EVENT_WINDOW_MS) laterCount += 1;
  }

  tabs.program.textContent = `\u{1F4C5} Alla (${activeCount})`;
  tabs.program.title = `Alla evenemang (${activeCount} st)`;
  tabs.cancelled.textContent = `\u{1F6AB} Inställda (${cancelledCount})`;
  tabs.cancelled.title = `Inställda evenemang (${cancelledCount} st)`;
  tabs.favorites.textContent = `\u2B50 Favoriter (${favoriteCount})`;
  tabs.favorites.title = `Favoritevenemang (${favoriteCount} st)`;
  tabs.live.textContent = `\u{1F550} Pågående (${liveCount})`;
  tabs.live.title = `Pågående evenemang (${liveCount} st)`;
  tabs.recent.textContent = `\u23EA Startat nyss (${recentCount})`;
  tabs.recent.title = `Evenemang som startat nyss (${recentCount} st)`;
  tabs.soon.textContent = `\u23E9 Startar strax (${soonCount})`;
  tabs.soon.title = `Evenemang som startar strax (${soonCount} st)`;
  tabs.later.textContent = `\u23F3 Startar senare (${laterCount})`;
  tabs.later.title = `Evenemang som startar senare (${laterCount} st)`;
  tabs.finished.textContent = `\u2705 Avslutade (${finishedCount})`;
  tabs.finished.title = `Avslutade evenemang (${finishedCount} st)`;
  tabs.unfinished.textContent = `\u25EF Ej avslutade (${unfinishedCount})`;
  tabs.unfinished.title = `Ej avslutade evenemang (${unfinishedCount} st)`;
}

function coordinatesToMapQuery(coordinates) {
  if (!coordinates || typeof coordinates !== 'object') return null;

  const latitude = Number(coordinates.latitude ?? coordinates.lat);
  const longitude = Number(coordinates.longitude ?? coordinates.lng ?? coordinates.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0) ? `${latitude},${longitude}` : null;
}

function matchesSearch(event) {
  const searchTerm = $search.value.trim().toLocaleLowerCase('sv-SE');
  if (!searchTerm) return true;

  return event.searchText.includes(searchTerm);
}

function selectedFilterValues(filter) {
  return Array.from(filter.options.querySelectorAll('input:checked'))
    .map((input) => input.value)
    .filter((value) => value !== 'all');
}

function displayFilterValue(filter, value) {
  if (filter.eventProperty === 'languageNames' && String(value).toLocaleLowerCase('sv-SE').includes('kräver inga språkkunskaper')) return 'Inga språkkunskaper';
  return value;
}

function languageFilterPriority(language) {
  const normalizedLanguage = String(language).trim().toLocaleLowerCase('sv-SE');
  if (normalizedLanguage === 'svenska') return 0;
  if (normalizedLanguage === 'engelska') return 1;
  return 2;
}

function matchesMultiFilters(event) {
  return multiFilters.every((filter) => {
    const selectedValues = selectedFilterValues(filter);
    if (selectedValues.length === 0) return true;

    const eventValues = Array.isArray(event[filter.eventProperty]) ? event[filter.eventProperty] : [];
    return eventValues.some((value) => selectedValues.includes(value));
  });
}

function matchesChildrenFilter(event) {
  if ($childrenFilter.checked) return event.isForChildren === true;
  if ($adultsFilter.checked) return event.isForChildren === false;
  return true;
}

function matchesFreeFilter(event) {
  if ($freeFilter.checked) return event.isFree === true;
  if ($paidFilter.checked) return event.isFree === false;
  return true;
}

function clockMinutes(value) {
  const formattedTime = formatLocalClockTime(value);
  const match = formattedTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function eventEndClockMinutes(event) {
  return clockMinutes(event.end || event.endTime || event.endTimeText) ?? clockMinutes(new Date(eventEndTime(event)).toISOString());
}

function filterStartClockMinutes(value) {
  return /^\d{2}$/.test(value) ? Number(value) * 60 : null;
}

function filterEndClockMinutes(value) {
  return /^\d{2}$/.test(value) ? Number(value) * 60 + 59 : null;
}

function matchesTimeFilters(event) {
  const fromTime = filterStartClockMinutes($fromFilter.value);
  const toTime = filterEndClockMinutes($toFilter.value);
  if (fromTime === null && toTime === null) return true;

  const startTime = event.startMinutes;
  const endTime = event.endMinutes;
  if (startTime === null || endTime === null) return false;

  return (fromTime === null || endTime >= fromTime) && (toTime === null || startTime <= toTime);
}

function matchesActiveFilters(event) {
  return matchesSearch(event) && matchesChildrenFilter(event) && matchesFreeFilter(event) && matchesMultiFilters(event) && matchesTimeFilters(event);
}

function populateMultiFilter(filter, items) {
  const orderedItems = filter.eventProperty === 'languageNames' ? items.slice().sort((first, second) => languageFilterPriority(first?.name) - languageFilterPriority(second?.name)) : items;
  for (const item of orderedItems) {
    if (!item?.name) continue;
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.name;
    label.append(input, ` ${displayFilterValue(filter, item.name)}`);
    filter.options.appendChild(label);
  }
}

function updateFilterSummary(filter) {
  const selectedValues = selectedFilterValues(filter);
  filter.summary.textContent = selectedValues.length === 0 ? filter.allLabel : `${selectedValues.length} ${filter.selectedLabel}`;
}

function addCategoryFilter(category) {
  const categoryFilter = multiFilters[0];
  const categoryInput = Array.from(categoryFilter.options.querySelectorAll('input:not([value="all"])')).find((input) => input.value === category);
  if (!categoryInput) return;

  for (const input of categoryFilter.options.querySelectorAll('input')) input.checked = false;
  const allOption = categoryFilter.options.querySelector('input[value="all"]');
  if (allOption) allOption.checked = false;
  categoryInput.checked = true;
  updateFilterSummary(categoryFilter);
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
}

function createCategoryChip(category) {
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'chip';
  tag.textContent = category;
  tag.addEventListener('click', (event) => {
    event.stopPropagation();
    addCategoryFilter(category);
  });
  return tag;
}

function setFavoriteIcon(star, isFavorite) {
  star.innerHTML = isFavorite ? '<i class="fa-solid fa-star" aria-hidden="true"></i>' : '<i class="fa-sharp fa-regular fa-star" aria-hidden="true"></i>';
}

function updateClearFiltersButton() {
  $clearFilters.disabled = !$search.value && !$childrenFilter.checked && !$adultsFilter.checked && !$freeFilter.checked && !$paidFilter.checked && !$fromFilter.value && !$toFilter.value && multiFilters.every((filter) => selectedFilterValues(filter).length === 0);
}

function updateFilterCount() {
  const selectedCount = multiFilters.reduce((count, filter) => count + selectedFilterValues(filter).length, 0) + ($search.value.trim() ? 1 : 0) + ($childrenFilter.checked ? 1 : 0) + ($adultsFilter.checked ? 1 : 0) + ($freeFilter.checked ? 1 : 0) + ($paidFilter.checked ? 1 : 0) + ($fromFilter.value ? 1 : 0) + ($toFilter.value ? 1 : 0);
  const countLabel = selectedCount > 0 ? ` (${selectedCount})` : '';
  $filterCount.textContent = countLabel;
  updateShowFiltersButton(countLabel);
}

function updateShowFiltersButton(countLabel = $filterCount.textContent) {
  const label = '<i class="fa-solid fa-filter" aria-hidden="true"></i>';
  const actionLabel = $filterSearchSection.open ? 'Dölj filter' : 'Visa filter';
  $showFiltersLabel.innerHTML = label;
  $showFilters.setAttribute('aria-label', `${actionLabel}${countLabel}`);
  $showFilters.title = `${actionLabel}${countLabel}`;
}

function updateSelectedFilters(filteredEventCount) {
  const selectedFilters = [];
  if ($search.value.trim()) selectedFilters.push($search.value.trim());
  if ($childrenFilter.checked) selectedFilters.push('Barn');
  if ($adultsFilter.checked) selectedFilters.push('Vuxna');
  if ($freeFilter.checked) selectedFilters.push('Gratis');
  if ($paidFilter.checked) selectedFilters.push('Kostar');
  for (const filter of multiFilters) selectedFilters.push(...selectedFilterValues(filter).map((value) => displayFilterValue(filter, value)));
  if ($fromFilter.value) selectedFilters.push(`Från ${$fromFilter.value}`);
  if ($toFilter.value) selectedFilters.push(`Till ${$toFilter.value}`);
  const finishedVisibilityText = hideFinishedEvents ? 'dölj avslutade' : 'visa avslutade';
  const selectedFilterText = `${selectedFilters.length > 0 ? selectedFilters.join(', ') : 'Inga'} + ${finishedVisibilityText}`;
  $selectedFilters.replaceChildren();
  const label = document.createElement('span');
  label.textContent = 'Filter:';
  const values = document.createElement('span');
  values.textContent = ` ${selectedFilterText} (${filteredEventCount})`;
  $selectedFilters.append(label, values);
}

function languageCountryCode(language) {
  const normalizedLanguage = String(language).toLocaleLowerCase('sv-SE');
  if (normalizedLanguage.includes('kräver inga språkkunskaper')) return null;
  if (normalizedLanguage.includes('arabiska')) return 'sa';
  if (normalizedLanguage.includes('engelska')) return 'gb';
  if (normalizedLanguage.includes('finska')) return 'fi';
  if (normalizedLanguage.includes('franska')) return 'fr';
  if (normalizedLanguage.includes('italienska')) return 'it';
  if (normalizedLanguage.includes('kinesiska')) return 'cn';
  if (normalizedLanguage.includes('polska')) return 'pl';
  if (normalizedLanguage.includes('ryska')) return 'ru';
  if (normalizedLanguage.includes('spanska')) return 'es';
  if (normalizedLanguage.includes('svenska')) return 'se';
  if (normalizedLanguage.includes('tyska')) return 'de';
  if (normalizedLanguage.includes('ukrainska')) return 'ua';
  return null;
}

function displayLanguageName(language) {
  return String(language).toLocaleLowerCase('sv-SE').includes('kräver inga språkkunskaper') ? 'Språkoberoende' : language;
}

function locationIconClass(location) {
  const normalizedLocation = String(location).toLocaleLowerCase('sv-SE');
  if (normalizedLocation.includes('inomhus')) return 'fa-solid fa-building';
  if (normalizedLocation.includes('utomhus')) return 'fa-solid fa-tree';
  if (normalizedLocation.includes('scen')) return 'fa-solid fa-masks-theater';
  if (normalizedLocation.includes('digitalt')) return 'fa-solid fa-laptop';
  return 'fa-solid fa-location-dot';
}

function accessibilityIconClass(accessibility) {
  const normalizedAccessibility = String(accessibility).toLocaleLowerCase('sv-SE');
  if (normalizedAccessibility.includes('barnvagn')) return 'fa-solid fa-baby-carriage';
  if (normalizedAccessibility.includes('hörselskadade')) return 'fa-solid fa-ear-listen';
  if (normalizedAccessibility.includes('hiss')) return 'fa-solid fa-elevator';
  if (normalizedAccessibility.includes('rullstol') && normalizedAccessibility.includes('toalett')) return 'fa-solid fa-restroom';
  if (normalizedAccessibility.includes('rullstol')) return 'fa-solid fa-wheelchair';
  if (normalizedAccessibility.includes('synskadade')) return 'fa-solid fa-eye-low-vision';
  return 'fa-solid fa-universal-access';
}

function closeFilters() {
  if ($filterSearchSection.open) $filterSearchSection.close();
  $showFilters.setAttribute('aria-expanded', 'false');
  $showFilters.setAttribute('aria-pressed', 'false');
  updateShowFiltersButton();
}

function clearActiveFocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function positionFiltersDialog() {
  if (!window.matchMedia('(min-width: 641px)').matches) {
    $filterSearchSection.style.top = '';
    $filterSearchSection.style.right = '';
    $filterSearchSection.style.left = '';
    return;
  }

  const buttonBounds = $showFilters.getBoundingClientRect();
  const horizontalMargin = 12;

  $filterSearchSection.style.top = `${buttonBounds.bottom + 8}px`;
  $filterSearchSection.style.right = `${Math.max(horizontalMargin, window.innerWidth - buttonBounds.right)}px`;
  $filterSearchSection.style.left = 'auto';
}

function createEventDetails(ev, eventTitle) {
  const details = document.createElement('div');
  details.className = 'event-details';
  details.hidden = true;

  if (ev.about) {
    const about = document.createElement('p');
    about.className = 'event-about';
    about.textContent = ev.about;
    details.appendChild(about);
  }

  if (!SHOW_CATEGORIES_IN_LIST) {
    const categoryNames = Array.isArray(ev.categoryNames) ? ev.categoryNames : [];
    if (categoryNames.length > 0) {
      const categories = document.createElement('div');
      categories.className = 'tag-row has-tags';
      for (const category of categoryNames) {
        categories.appendChild(createCategoryChip(category));
      }
      details.appendChild(categories);
    }
  }

  const detailsList = document.createElement('ul');
  detailsList.className = 'event-detail-list';

  if (typeof ev.isFree === 'boolean') {
    const freeAdmission = document.createElement('li');
    freeAdmission.textContent = `Gratis: ${ev.isFree ? 'Ja' : 'Nej'}`;
    detailsList.appendChild(freeAdmission);
  }

  if (typeof ev.isForChildren === 'boolean') {
    const audience = document.createElement('li');
    audience.appendChild(document.createTextNode('Målgrupp:'));
    const audienceList = document.createElement('ul');
    audienceList.className = 'accessibility-list';
    const audienceListItem = document.createElement('li');
    const audienceItem = document.createElement('span');
    audienceItem.className = 'accessibility-item';
    const audienceIcon = document.createElement('i');
    audienceIcon.className = `fa-solid ${ev.isForChildren ? 'fa-children' : 'fa-user'} accessibility-icon`;
    audienceIcon.setAttribute('aria-hidden', 'true');
    audienceItem.appendChild(audienceIcon);
    audienceItem.appendChild(document.createTextNode(ev.isForChildren ? 'Barn och vuxna' : 'Vuxna'));
    audienceListItem.appendChild(audienceItem);
    audienceList.appendChild(audienceListItem);
    audience.appendChild(audienceList);
    detailsList.appendChild(audience);
  }

  const languageNames = Array.isArray(ev.languageNames) ? ev.languageNames.filter(Boolean) : [];
  const languages = document.createElement('li');
  languages.appendChild(document.createTextNode('Språk: '));
  if (languageNames.length > 0) {
    const languageList = document.createElement('ul');
    languageList.className = 'language-list';
    languageNames.forEach((language) => {
      const languageListItem = document.createElement('li');
      const languageItem = document.createElement('span');
      languageItem.className = 'language-item';
      const countryCode = languageCountryCode(language);
      if (countryCode) {
        const languageIcon = document.createElement('img');
        languageIcon.className = 'language-country-icon';
        languageIcon.src = `https://flagcdn.com/16x12/${countryCode}.png`;
        languageIcon.srcset = `https://flagcdn.com/32x24/${countryCode}.png 2x`;
        languageIcon.alt = '';
        languageIcon.width = 16;
        languageIcon.height = 12;
        languageItem.appendChild(languageIcon);
      } else {
        const languageIcon = document.createElement('i');
        languageIcon.className = 'fa-solid fa-globe language-country-icon';
        languageIcon.setAttribute('aria-hidden', 'true');
        languageItem.appendChild(languageIcon);
      }
      languageItem.appendChild(document.createTextNode(displayLanguageName(language)));
      languageListItem.appendChild(languageItem);
      languageList.appendChild(languageListItem);
    });
    languages.appendChild(languageList);
  } else {
    const languageList = document.createElement('ul');
    languageList.className = 'language-list';
    const languageListItem = document.createElement('li');
    const languageItem = document.createElement('span');
    languageItem.className = 'language-item';
    const languageIcon = document.createElement('i');
    languageIcon.className = 'fa-solid fa-globe language-country-icon';
    languageIcon.setAttribute('aria-hidden', 'true');
    languageItem.appendChild(languageIcon);
    languageItem.appendChild(document.createTextNode('Ej angivet'));
    languageListItem.appendChild(languageItem);
    languageList.appendChild(languageListItem);
    languages.appendChild(languageList);
  }
  detailsList.appendChild(languages);

  const accessibilityNames = Array.isArray(ev.accessibilityNames) ? ev.accessibilityNames.filter(Boolean) : [];
  const accessibility = document.createElement('li');
  accessibility.appendChild(document.createTextNode('Tillgänglighet: '));
  if (accessibilityNames.length > 0) {
    const accessibilityList = document.createElement('ul');
    accessibilityList.className = 'accessibility-list';
    accessibilityNames.forEach((accessibilityName, index) => {
      const accessibilityListItem = document.createElement('li');
      const accessibilityItem = document.createElement('span');
      accessibilityItem.className = 'accessibility-item';
      const accessibilityIcon = document.createElement('i');
      accessibilityIcon.className = `${accessibilityIconClass(accessibilityName)} accessibility-icon`;
      accessibilityIcon.setAttribute('aria-hidden', 'true');
      accessibilityItem.appendChild(accessibilityIcon);
      accessibilityItem.appendChild(document.createTextNode(accessibilityName));
      accessibilityListItem.appendChild(accessibilityItem);
      accessibilityList.appendChild(accessibilityListItem);
    });
    accessibility.appendChild(accessibilityList);
  } else {
    const accessibilityList = document.createElement('ul');
    accessibilityList.className = 'accessibility-list';
    const accessibilityListItem = document.createElement('li');
    const accessibilityItem = document.createElement('span');
    accessibilityItem.className = 'accessibility-item';
    const accessibilityIcon = document.createElement('i');
    accessibilityIcon.className = 'fa-solid fa-circle-question accessibility-icon';
    accessibilityIcon.setAttribute('aria-hidden', 'true');
    accessibilityItem.appendChild(accessibilityIcon);
    accessibilityItem.appendChild(document.createTextNode('Ej angivet'));
    accessibilityListItem.appendChild(accessibilityItem);
    accessibilityList.appendChild(accessibilityListItem);
    accessibility.appendChild(accessibilityList);
  }
  detailsList.appendChild(accessibility);

  const locationNames = Array.isArray(ev.locationNames) ? ev.locationNames.map((location) => String(location).trim()).filter(Boolean) : [];
  if (locationNames.length > 0) {
    const locations = document.createElement('li');
    locations.appendChild(document.createTextNode('Plats: '));
    const locationList = document.createElement('ul');
    locationList.className = 'location-list';
    locationNames.forEach((locationName) => {
      const locationListItem = document.createElement('li');
      const locationItem = document.createElement('span');
      locationItem.className = 'location-item';
      const locationIcon = document.createElement('i');
      locationIcon.className = `${locationIconClass(locationName)} location-icon`;
      locationIcon.setAttribute('aria-hidden', 'true');
      locationItem.appendChild(locationIcon);
      locationItem.appendChild(document.createTextNode(locationName));
      locationListItem.appendChild(locationItem);
      locationList.appendChild(locationListItem);
    });
    locations.appendChild(locationList);
    detailsList.appendChild(locations);
  }

  if (ev.organizer) {
    const organizer = document.createElement('li');
    organizer.textContent = 'Arrangör: ';
    if (ev.webpage) {
      const link = document.createElement('a');
      link.href = ev.webpage;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = ev.organizer;
      organizer.appendChild(link);
    } else if (ev.organizer) {
      organizer.appendChild(document.createTextNode(ev.organizer));
    }
    detailsList.appendChild(organizer);
  }

  if (ev.url) {
    const source = document.createElement('li');
    source.appendChild(document.createTextNode('Källa: '));
    const link = document.createElement('a');
    link.href = ev.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'kulturnatten.uppsala.se';
    source.appendChild(link);
    detailsList.appendChild(source);
  }

  const type = document.createElement('li');
  type.textContent = `Typ: ${ev.type === 'subEvent' ? 'Del av evenemang' : 'Evenemang'}`;
  detailsList.appendChild(type);

  const updatedStatus = formatUpdatedStatus(ev);
  if (ev.startTime) {
    const startsAt = document.createElement('li');
    startsAt.textContent = `Startar: ${formatLocalDateTime(ev.startTime) ?? ev.startTime}`;
    detailsList.appendChild(startsAt);

    const endsAt = document.createElement('li');
    endsAt.textContent = `Slutar: ${ev.endTime ? (formatLocalDateTime(ev.endTime) ?? ev.endTime) : 'Ej angivet'}`;
    detailsList.appendChild(endsAt);
  }

  if (updatedStatus) {
    const updatedAt = document.createElement('li');
    updatedAt.textContent = updatedStatus;
    detailsList.appendChild(updatedAt);
  }

  const checked = formatLocalDateTime(ev.checked);
  if (debugEnabled && checked) {
    const checkedAt = document.createElement('li');
    checkedAt.textContent = `Kontrollerad: ${checked}`;
    detailsList.appendChild(checkedAt);
  }

  if (ev.streetAddress) {
    const address = document.createElement('li');
    address.textContent = `Address: ${ev.streetAddress}`;
    detailsList.appendChild(address);
  }

  if (detailsList.childElementCount > 0) details.appendChild(detailsList);

  const mapQuery = coordinatesToMapQuery(ev.coordinates);
  if (mapQuery) {
    const mapToggle = document.createElement('button');
    mapToggle.type = 'button';
    mapToggle.className = 'map-toggle';
    mapToggle.textContent = 'Visa karta';
    mapToggle.setAttribute('aria-expanded', 'false');

    const map = document.createElement('iframe');
    map.className = 'event-map';
    map.title = `Google Map: ${eventTitle}`;
    map.loading = 'lazy';
    map.referrerPolicy = 'no-referrer-when-downgrade';
    map.hidden = true;
    let mapLoaded = false;

    mapToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!mapLoaded) {
        map.src = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
        mapLoaded = true;
      }
      map.hidden = !map.hidden;
      mapToggle.textContent = map.hidden ? 'Visa karta' : 'Göm karta';
      mapToggle.setAttribute('aria-expanded', String(!map.hidden));
    });

    details.appendChild(mapToggle);
    details.appendChild(map);
  }

  return details.childElementCount > 0 ? details : null;
}

function renderList(events, favorites = loadFavorites()) {
  $list.innerHTML = '';
  if (!events || events.length === 0) {
    $list.innerHTML = '<div class="no-events">Inga evenemang</div>';
    return;
  }
  const favoriteIds = new Set(favorites);
  const fragment = document.createDocumentFragment();
  let openCard = null;
  for (const ev of events) {
    const card = document.createElement('div');
    card.className = 'card';
    card.classList.toggle('cancelled', Boolean(ev.isCancelled));
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const timeLine = document.createElement('div');
    timeLine.className = 'line time-line';

    const startValue = formatLocalClockTime(ev.start || ev.startTime || ev.startTimeText || ev.time || '—');
    const endValue = ev.end || ev.endTime || ev.endTimeText ? formatLocalClockTime(ev.end || ev.endTime || ev.endTimeText) : null;
    const timeText = endValue ? `${startValue}–${endValue}` : startValue;
    const isFinished = isFinishedEvent(ev);
    card.classList.toggle('finished', isFinished);

    const timeLabel = document.createElement('span');
    timeLabel.textContent = timeText;

    const eventStatus = ev.isCancelled ? '(INSTÄLLD)' : isFinished ? '(AVSLUTAD)' : null;
    if (eventStatus) {
      const statusLabel = document.createElement('span');
      statusLabel.className = 'event-status';
      statusLabel.textContent = eventStatus;
      timeLine.appendChild(statusLabel);
    }

    const titleText = document.createElement('span');
    titleText.className = 'event-title';
    const eventTitle = ev.title || ev.name || ev.displayName || 'Untitled';
    titleText.textContent = eventTitle;

    const titleGroup = document.createElement('span');
    titleGroup.className = 'event-title-group';
    titleGroup.appendChild(titleText);

    const titleLine = document.createElement('div');
    titleLine.className = 'line';
    titleLine.appendChild(titleGroup);

    timeLine.prepend(timeLabel);

    const parentTitle = ev.parentTitle || ev.parent || ev.groupTitle;
    let parentLine = null;
    if (parentTitle && !(parentTitle === eventTitle && parentTitle === (ev.locationAlias || ev.locationName || ev.location || '—'))) {
      parentLine = document.createElement('div');
      parentLine.className = 'line secondary';
      parentLine.textContent = parentTitle;
    }

    const locationAlias = ev.locationAlias || ev.locationName || ev.location || '—';
    const locationLine = document.createElement('div');
    locationLine.className = 'line secondary';
    const hideLocationAlias = locationAlias === eventTitle || (parentLine && parentTitle === locationAlias);
    if (!hideLocationAlias) {
      locationLine.textContent = locationAlias;
    }

    const tags = document.createElement('div');
    tags.className = 'tag-row';
    const categoryNames = Array.isArray(ev.categoryNames) ? ev.categoryNames : [];
    if (categoryNames.length === 0 && ev.categoryName) {
      categoryNames.push(ev.categoryName);
    }

    if (SHOW_CATEGORIES_IN_LIST && categoryNames.length > 0) {
      tags.classList.add('has-tags');
    }

    for (const category of SHOW_CATEGORIES_IN_LIST ? categoryNames : []) {
      tags.appendChild(createCategoryChip(category));
    }

    const star = document.createElement('span');
    star.className = 'star';
    star.setAttribute('role', 'button');
    star.tabIndex = 0;
    star.setAttribute('aria-label', 'Toggle favorite');
    const myid = ev.favoriteId;
    const active = favoriteIds.has(myid);
    setFavoriteIcon(star, active);
    star.setAttribute('aria-pressed', String(active));
    if (!active) star.classList.add('inactive');
    star.onclick = (event) => {
      event.stopPropagation();
      const cur = loadFavorites();
      const i = cur.indexOf(myid);
      if (i === -1) cur.push(myid);
      else cur.splice(i, 1);
      saveFavorites(cur);
      updateTabCounts();
      const isFavorite = cur.includes(myid);
      setFavoriteIcon(star, isFavorite);
      star.classList.toggle('inactive', !isFavorite);
      star.setAttribute('aria-pressed', String(isFavorite));
    };
    star.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        star.click();
      }
    });
    titleGroup.appendChild(star);
    titleLine.title = `${timeText} ${titleText.textContent}`;

    let details = null;

    card.setAttribute('aria-expanded', 'false');
    const toggleDetails = () => {
      if (!details) {
        details = createEventDetails(ev, eventTitle);
        if (!details) return;
        card.appendChild(details);
        card.details = details;
      }
      if (details.hidden && openCard && openCard !== card) {
        openCard.details.hidden = true;
        openCard.setAttribute('aria-expanded', 'false');
      }
      details.hidden = !details.hidden;
      card.setAttribute('aria-expanded', String(!details.hidden));
      openCard = details.hidden ? null : card;
      if (!details.hidden) {
        const offset = $header.getBoundingClientRect().height + 4;
        const cardTop = card.getBoundingClientRect().top;
        if (cardTop < offset || cardTop > window.innerHeight) {
          window.scrollTo({ top: cardTop + window.scrollY - offset, behavior: 'smooth' });
        }
      }
    };
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, .star')) return;
      toggleDetails();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleDetails();
      }
    });

    card.appendChild(timeLine);
    card.appendChild(titleLine);
    if (parentLine) card.appendChild(parentLine);
    if (locationLine.textContent) card.appendChild(locationLine);
    const updatedStatus = formatUpdatedStatus(ev);
    if (programSortMode === 'updated' && updatedStatus) {
      const updatedLine = document.createElement('div');
      updatedLine.className = 'line secondary';
      updatedLine.textContent = updatedStatus;
      card.appendChild(updatedLine);
    }
    card.appendChild(tags);
    fragment.appendChild(card);
  }
  $list.appendChild(fragment);
}

function setActive(tab) {
  activeTab = tab;
  $tabSelect.value = tab;
  $activeTabHeading.textContent = `${tabIcon(tab)} ${tabTooltip(tab)}`;
  $programSortControls.hidden = tab !== 'program';
  const favs = loadFavorites();
  const favoriteIds = new Set(favs);
  const now = eventCurrentTime();
  let events = [];
  if (tab === 'program') {
    events = sortProgramEvents(allEvents.filter((event) => !event.isCancelled));
  } else if (tab === 'cancelled') {
    events = allEvents.filter((event) => event.isCancelled);
  } else if (tab === 'favorites') {
    events = allEvents.filter((event) => favoriteIds.has(event.favoriteId));
  } else if (tab === 'live') {
    events = liveEvents(allEvents, now);
  } else if (tab === 'recent') {
    events = eventsInWindow(allEvents, now - RECENT_EVENT_WINDOW_MS, now);
  } else if (tab === 'soon') {
    events = eventsInWindow(allEvents, now, now + SOON_EVENT_WINDOW_MS);
  } else if (tab === 'later') {
    events = laterEvents(allEvents, now + SOON_EVENT_WINDOW_MS);
  } else if (tab === 'finished') {
    events = allEvents.filter((event) => isFinishedEvent(event, now));
  } else if (tab === 'unfinished') {
    events = allEvents.filter((event) => !event.isCancelled && !isFinishedEvent(event, now));
  }
  events = visibleByFinishedToggle(events, tab, now);
  const filteredEvents = events.filter(matchesActiveFilters);
  updateSelectedFilters(filteredEvents.length);
  renderList(filteredEvents, favs);
}

$tabSelect.addEventListener('change', () => setActive($tabSelect.value));
$infoButton.addEventListener('click', () => {
  $infoDialog.showModal();
  requestAnimationFrame(() => $infoClose.focus());
});
$infoClose.addEventListener('click', () => $infoDialog.close());
$infoDialog.addEventListener('click', (event) => {
  if (event.target === $infoDialog) $infoDialog.close();
});
$finishedVisibilityToggle.addEventListener('click', () => {
  hideFinishedEvents = !hideFinishedEvents;
  localStorage.setItem('hideFinishedEvents', String(hideFinishedEvents));
  scheduleCloudSettingsSync();
  updateFinishedVisibilityToggle();
  updateTabCounts();
  setActive(activeTab);
});
$themeToggle.addEventListener('click', () => {
  setTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
});
$loginButton.addEventListener('click', async () => {
  if (!(await ensureFirebaseAuthentication())) return;
  if (firebaseUser) {
    const willOpen = $userMenu.hidden;
    $userMenu.hidden = !willOpen;
    $loginButton.setAttribute('aria-expanded', String(willOpen));
    return;
  }

  openAuthenticationDialog();
});
$syncLoginLink.addEventListener('click', (event) => {
  event.preventDefault();
  if (firebaseUser) return;
  ensureFirebaseAuthentication().then((isReady) => {
    if (isReady && !firebaseUser) openAuthenticationDialog();
  });
});
$logoutButton.addEventListener('click', async () => {
  if (!firebaseAuth) return;
  try {
    await firebaseAuth.signOut();
  } catch (error) {
    console.error('Firebase sign-out failed:', error);
    setStatus(`Utloggningen misslyckades: ${error?.message || error}`);
  }
});
$authClose.addEventListener('click', () => $authDialog.close());
$authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!(await ensureFirebaseAuthentication())) return;

  const action = event.submitter?.value;
  const email = $authEmail.value.trim();
  const password = $authPassword.value;
  try {
    showAuthMessage('Väntar...');
    if (action === 'register') {
      await firebaseAuth.createUserWithEmailAndPassword(email, password);
    } else {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
    }
    $authDialog.close();
  } catch (error) {
    console.error('Firebase email authentication failed:', error);
    showAuthMessage(error?.message || 'Inloggningen misslyckades.');
  }
});
$googleLoginButton.addEventListener('click', async () => {
  if (!(await ensureFirebaseAuthentication())) return;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebaseAuth.signInWithPopup(provider);
    $authDialog.close();
  } catch (error) {
    console.error('Firebase Google authentication failed:', error);
    showAuthMessage(error?.message || 'Google-inloggningen misslyckades.');
  }
});
$programSortStart.addEventListener('click', () => {
  programSortMode = 'start';
  updateProgramSortControls();
  setActive('program');
});
$programSortSeen.addEventListener('click', () => {
  programSortMode = 'updated';
  updateProgramSortControls();
  setActive('program');
});
$showFilters.addEventListener('click', () => {
  if ($filterSearchSection.open) {
    closeFilters();
    return;
  }
  $filterSearchSection.showModal();
  positionFiltersDialog();
  requestAnimationFrame(clearActiveFocus);
  $showFilters.setAttribute('aria-expanded', 'true');
  $showFilters.setAttribute('aria-pressed', 'true');
  updateShowFiltersButton();
});
$closeFilters.addEventListener('click', closeFilters);
$closeFiltersBottom.addEventListener('click', closeFilters);
$filterSearchSection.addEventListener('close', () => {
  $showFilters.setAttribute('aria-expanded', 'false');
  $showFilters.setAttribute('aria-pressed', 'false');
  updateShowFiltersButton();
});
$filterSearchSection.addEventListener('click', (event) => {
  if (event.target === $filterSearchSection) closeFilters();
});
window.addEventListener('resize', () => {
  if ($filterSearchSection.open) positionFiltersDialog();
});
$search.addEventListener('input', () => {
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
$childrenFilter.addEventListener('change', () => {
  if ($childrenFilter.checked) $adultsFilter.checked = false;
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
$adultsFilter.addEventListener('change', () => {
  if ($adultsFilter.checked) $childrenFilter.checked = false;
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
$freeFilter.addEventListener('change', () => {
  if ($freeFilter.checked) $paidFilter.checked = false;
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
$paidFilter.addEventListener('change', () => {
  if ($paidFilter.checked) $freeFilter.checked = false;
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
for (const timeFilter of [$fromFilter, $toFilter]) {
  timeFilter.addEventListener('input', () => {
    updateClearFiltersButton();
    updateFilterCount();
    setActive(activeTab);
  });
}
$clearFilters.addEventListener('click', () => {
  $search.value = '';
  $childrenFilter.checked = false;
  $adultsFilter.checked = false;
  $freeFilter.checked = false;
  $paidFilter.checked = false;
  $fromFilter.value = '';
  $toFilter.value = '';
  for (const filter of multiFilters) {
    for (const input of filter.options.querySelectorAll('input')) input.checked = input.value === 'all';
    filter.menu.open = false;
    updateFilterSummary(filter);
  }
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
document.addEventListener('click', (event) => {
  for (const filter of multiFilters) {
    if (filter.menu.open && !event.composedPath().includes(filter.menu)) filter.menu.open = false;
  }
  if (!$userMenu.hidden && !event.composedPath().includes($loginButton) && !event.composedPath().includes($userMenu)) {
    $userMenu.hidden = true;
    $loginButton.setAttribute('aria-expanded', 'false');
  }
});
for (const filter of multiFilters) {
  filter.options.addEventListener('change', (event) => {
    const changedInput = event.target;
    if (!(changedInput instanceof HTMLInputElement)) return;

    const allOption = filter.options.querySelector('input[value="all"]');
    const namedOptions = Array.from(filter.options.querySelectorAll('input:not([value="all"])'));
    if (changedInput.value === 'all' && changedInput.checked) {
      for (const input of namedOptions) input.checked = false;
    } else if (changedInput.checked && allOption) {
      allOption.checked = false;
    } else if (!namedOptions.some((input) => input.checked) && allOption) {
      allOption.checked = true;
    }
    updateFilterSummary(filter);
    updateClearFiltersButton();
    updateFilterCount();
    setActive(activeTab);
  });
}

async function main() {
  try {
    setStatus('Loading...');
    populateHourFilter($fromFilter);
    populateHourFilter($toFilter);
    const res = await fetch(DATA_PATH);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const json = await res.json();
    const events = json && Array.isArray(json.events) ? json.events : Array.isArray(json) ? json : [];
    allEvents = events.map(normalizeEvent).sort((a, b) => a.startMs - b.startMs);
    populateMultiFilter(multiFilters[0], Array.isArray(json?.categories) ? json.categories : []);
    populateMultiFilter(multiFilters[1], Array.isArray(json?.languages) ? json.languages : []);
    populateMultiFilter(multiFilters[2], Array.isArray(json?.locations) ? json.locations : []);
    populateMultiFilter(multiFilters[3], Array.isArray(json?.accessibilities) ? json.accessibilities : []);
    updateFinishedVisibilityToggle();
    updateClearFiltersButton();
    updateFilterCount();
    updateTabCounts();
    setStatus();
    setActive('program');
  } catch (err) {
    setStatus('Failed to load events: ' + (err && err.message ? err.message : String(err)));
    console.error(err);
  }
}

main().finally(scheduleFirebaseIdleLoad);
