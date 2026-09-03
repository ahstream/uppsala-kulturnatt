const DATA_PATH = '/data/packedEvents.json';

const $header = document.querySelector('header');
const $status = document.getElementById('status');
const $activeTabHeading = document.getElementById('active-tab-heading');
const $programSortControls = document.getElementById('program-sort-controls');
const $programSortStart = document.getElementById('program-sort-start');
const $programSortSeen = document.getElementById('program-sort-seen');
const $finishedVisibilityToggle = document.getElementById('finished-visibility-toggle');
const $themeToggle = document.getElementById('theme-toggle');
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
const $filterPanel = document.getElementById('filter-panel');
const $filterCount = document.getElementById('filter-count');
const $selectedFilters = document.getElementById('selected-filters');
const $tabSelect = document.getElementById('tab-select');
const tabs = {
  program: document.getElementById('tab-program'),
  subevent: document.getElementById('tab-subevent'),
  cancelled: document.getElementById('tab-cancelled'),
  favorites: document.getElementById('tab-favorites'),
  live: document.getElementById('tab-live'),
  recent: document.getElementById('tab-recent'),
  soon: document.getElementById('tab-soon'),
  later: document.getElementById('tab-later'),
  finished: document.getElementById('tab-finished'),
  unfinished: document.getElementById('tab-unfinished'),
};
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
let filtersOpenedAt = 0;
let lastScrollY = window.scrollY;
let stickyDownScrollDistance = 0;
const RECENT_EVENT_WINDOW_MS = 15 * 60 * 1000;
const SOON_EVENT_WINDOW_MS = 45 * 60 * 1000;

function setTheme(theme, persist = true) {
  document.body.dataset.theme = theme;
  if (persist) localStorage.setItem('theme', theme);
  const isLight = theme === 'light';
  $themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-moon" aria-hidden="true"></i>' : '<i class="fa-solid fa-sun" aria-hidden="true"></i>';
  const label = isLight ? 'Byt till mörkt läge' : 'Byt till ljust läge';
  $themeToggle.setAttribute('aria-label', label);
  $themeToggle.title = label;
}

const savedTheme = localStorage.getItem('theme');
const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
setTheme(initialTheme, false);

function eventStartTime(event) {
  return new Date(event.start || event.startTime || 0).getTime();
}

function eventAssumedDuration(event) {
  return event.type === 'subEvent' ? 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
}

function eventEndTime(event) {
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
}

function updateTabCounts() {
  const favorites = loadFavorites();
  const now = eventCurrentTime();
  const visibleEvents = hideFinishedEvents ? allEvents.filter((event) => !isFinishedEvent(event, now)) : allEvents;
  const activeCount = visibleEvents.filter((event) => !event.isCancelled).length;
  const subeventCount = visibleEvents.filter((event) => event.type === 'subEvent').length;
  const cancelledCount = allEvents.filter((event) => event.isCancelled).length;
  const favoriteCount = visibleEvents.filter((event) => favorites.includes(idFor(event))).length;
  const liveCount = liveEvents(visibleEvents, now).length;
  const recentCount = eventsInWindow(visibleEvents, now - RECENT_EVENT_WINDOW_MS, now).length;
  const soonCount = eventsInWindow(visibleEvents, now, now + SOON_EVENT_WINDOW_MS).length;
  const laterCount = laterEvents(visibleEvents, now + SOON_EVENT_WINDOW_MS).length;
  const finishedCount = allEvents.filter((event) => isFinishedEvent(event, now)).length;
  const unfinishedCount = allEvents.filter((event) => !event.isCancelled && !isFinishedEvent(event, now)).length;

  tabs.program.textContent = `\u{1F4C5} Alla evenemang (${activeCount})`;
  tabs.program.title = `Alla evenemang (${activeCount} st)`;
  tabs.subevent.textContent = `\u{1F4C2} Inslag i evenemang (${subeventCount})`;
  tabs.subevent.title = `Inslag i evenemang (${subeventCount} st)`;
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

  return [event.title, event.name, event.displayName, event.locationAlias, event.locationName, event.location].some((value) =>
    String(value ?? '')
      .toLocaleLowerCase('sv-SE')
      .includes(searchTerm),
  );
}

function selectedFilterValues(filter) {
  return Array.from(filter.options.querySelectorAll('input:checked'))
    .map((input) => input.value)
    .filter((value) => value !== 'all');
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

  const startTime = clockMinutes(event.start || event.startTime || event.startTimeText || event.time);
  const endTime = eventEndClockMinutes(event);
  if (startTime === null || endTime === null) return false;

  return (fromTime === null || endTime >= fromTime) && (toTime === null || startTime <= toTime);
}

function populateMultiFilter(filter, items) {
  for (const item of items) {
    if (!item?.name) continue;
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.name;
    label.append(input, ` ${item.name}`);
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
  const actionLabel = $filterPanel.hidden ? 'Visa filter' : 'Dölj filter';
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
  for (const filter of multiFilters) selectedFilters.push(...selectedFilterValues(filter));
  if ($fromFilter.value) selectedFilters.push(`Från ${$fromFilter.value}`);
  if ($toFilter.value) selectedFilters.push(`Till ${$toFilter.value}`);
  const finishedVisibilityText = hideFinishedEvents ? 'dölj avslutade' : 'visa avslutade';
  const selectedFilterText = `${selectedFilters.length > 0 ? selectedFilters.join(', ') : 'Inga'} + ${finishedVisibilityText}`;
  $selectedFilters.replaceChildren();
  const label = document.createElement('span');
  label.className = 'filter-label';
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
  $filterSearchSection.hidden = true;
  $filterPanel.hidden = true;
  $showFilters.setAttribute('aria-expanded', 'false');
  $showFilters.setAttribute('aria-pressed', 'false');
  updateShowFiltersButton();
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

  if (ev.type === 'subEvent') {
    const startsAt = document.createElement('li');
    startsAt.textContent = `Startar: ${formatLocalDateTime(ev.startTime) ?? ev.startTime}`;
    detailsList.appendChild(startsAt);

    const endsAt = document.createElement('li');
    endsAt.textContent = `Slutar: ${ev.endTime ? (formatLocalDateTime(ev.endTime) ?? ev.endTime) : 'Ej angivet'}`;
    detailsList.appendChild(endsAt);
  }

  const updated = formatLocalDateTime(ev.updated);
  if (ev.startTime) {
    const startsAt = document.createElement('li');
    startsAt.textContent = `Startar: ${formatLocalDateTime(ev.startTime) ?? ev.startTime}`;
    detailsList.appendChild(startsAt);

    const endsAt = document.createElement('li');
    endsAt.textContent = `Slutar: ${ev.endTime ? (formatLocalDateTime(ev.endTime) ?? ev.endTime) : 'Ej angivet'}`;
    detailsList.appendChild(endsAt);
  }

  if (updated) {
    const updatedAt = document.createElement('li');
    updatedAt.textContent = `Uppdaterad ${updated}`;
    detailsList.appendChild(updatedAt);
  }

  const checked = formatLocalDateTime(ev.checked);
  if (checked) {
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

function renderList(events) {
  $list.innerHTML = '';
  if (!events || events.length === 0) {
    $list.innerHTML = '<div class="no-events">Inga evenemang</div>';
    return;
  }
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
    timeLabel.className = 'event-time';
    timeLabel.classList.toggle('finished', isFinished);
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
    titleLine.className = 'line title-line';
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
    const favs = loadFavorites();
    const myid = idFor(ev);
    const active = favs.includes(myid);
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
    const updated = formatLocalDateTime(ev.updated);
    if (programSortMode === 'updated' && updated) {
      const updatedLine = document.createElement('div');
      updatedLine.className = 'line secondary updated-line';
      updatedLine.textContent = `Uppdaterad ${updated}`;
      card.appendChild(updatedLine);
    }
    card.appendChild(tags);
    $list.appendChild(card);
  }
}

function setActive(tab) {
  activeTab = tab;
  $tabSelect.value = tab;
  $activeTabHeading.textContent = `${tabIcon(tab)} ${tabTooltip(tab)}`;
  $programSortControls.hidden = tab !== 'program';
  const favs = loadFavorites();
  const now = eventCurrentTime();
  let events = [];
  if (tab === 'program') {
    events = sortProgramEvents(allEvents.filter((event) => !event.isCancelled));
  } else if (tab === 'subevent') {
    events = allEvents.filter((event) => event.type === 'subEvent');
  } else if (tab === 'cancelled') {
    events = allEvents.filter((event) => event.isCancelled);
  } else if (tab === 'favorites') {
    events = allEvents.filter((event) => favs.includes(idFor(event)));
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
  const filteredEvents = events.filter(matchesSearch).filter(matchesChildrenFilter).filter(matchesFreeFilter).filter(matchesMultiFilters).filter(matchesTimeFilters);
  updateSelectedFilters(filteredEvents.length);
  renderList(filteredEvents);
}

$tabSelect.addEventListener('change', () => setActive($tabSelect.value));
$finishedVisibilityToggle.addEventListener('click', () => {
  hideFinishedEvents = !hideFinishedEvents;
  updateFinishedVisibilityToggle();
  updateTabCounts();
  setActive(activeTab);
});
$themeToggle.addEventListener('click', () => {
  setTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
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
  const openingFilters = $filterSearchSection.hidden;
  $filterSearchSection.hidden = !openingFilters;
  $filterPanel.hidden = !openingFilters;
  if (openingFilters) filtersOpenedAt = Date.now();
  $showFilters.setAttribute('aria-expanded', String(!$filterSearchSection.hidden));
  $showFilters.setAttribute('aria-pressed', String(!$filterSearchSection.hidden));
  updateShowFiltersButton();
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
window.addEventListener(
  'scroll',
  () => {
    if (!$filterPanel.hidden && Date.now() - filtersOpenedAt > 200) closeFilters();
    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollY;
    if (Math.abs(scrollDelta) < 8) return;

    if (scrollDelta < 0) {
      stickyDownScrollDistance = 0;
      $header.classList.remove('is-unstuck');
    } else if (!$header.classList.contains('is-unstuck')) {
      stickyDownScrollDistance += scrollDelta;
      if (stickyDownScrollDistance >= window.innerHeight * 0.25) $header.classList.add('is-unstuck');
    }
    lastScrollY = currentScrollY;
  },
  { passive: true },
);
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
  $search.focus();
});
document.addEventListener('click', (event) => {
  for (const filter of multiFilters) {
    if (filter.menu.open && !event.composedPath().includes(filter.menu)) filter.menu.open = false;
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
    $status.textContent = 'Loading...';
    populateHourFilter($fromFilter);
    populateHourFilter($toFilter);
    const res = await fetch(DATA_PATH);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const json = await res.json();
    const events = json && Array.isArray(json.events) ? json.events : Array.isArray(json) ? json : [];
    allEvents = events.slice().sort((a, b) => new Date(a.start || a.startTime || 0) - new Date(b.start || b.startTime || 0));
    populateMultiFilter(multiFilters[0], Array.isArray(json?.categories) ? json.categories : []);
    populateMultiFilter(multiFilters[1], Array.isArray(json?.languages) ? json.languages : []);
    populateMultiFilter(multiFilters[2], Array.isArray(json?.locations) ? json.locations : []);
    populateMultiFilter(multiFilters[3], Array.isArray(json?.accessibilities) ? json.accessibilities : []);
    updateFinishedVisibilityToggle();
    updateClearFiltersButton();
    updateFilterCount();
    updateTabCounts();
    $status.textContent = '';
    setActive('program');
  } catch (err) {
    $status.textContent = 'Failed to load events: ' + (err && err.message ? err.message : String(err));
    console.error(err);
  }
}

main();
