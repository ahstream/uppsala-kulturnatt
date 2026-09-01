const DATA_PATH = '/data/packedEvents.json';

const $header = document.querySelector('header');
const $status = document.getElementById('status');
const $activeTabHeading = document.getElementById('active-tab-heading');
const $programSortControls = document.getElementById('program-sort-controls');
const $programSortStart = document.getElementById('program-sort-start');
const $programSortSeen = document.getElementById('program-sort-seen');
const $themeToggle = document.getElementById('theme-toggle');
const $list = document.getElementById('list');
const $search = document.getElementById('event-search');
const $clearFilters = document.getElementById('clear-filters');
const $childrenFilter = document.getElementById('children-filter');
const $freeFilter = document.getElementById('free-filter');
const $fromFilter = document.getElementById('from-filter');
const $toFilter = document.getElementById('to-filter');
const $showFilters = document.getElementById('show-filters');
const $showFiltersLabel = document.getElementById('show-filters-label');
const $filterPanel = document.getElementById('filter-panel');
const $filterCount = document.getElementById('filter-count');
const $selectedFilters = document.getElementById('selected-filters');
const tabs = {
  program: document.getElementById('tab-program'),
  subevent: document.getElementById('tab-subevent'),
  cancelled: document.getElementById('tab-cancelled'),
  favorites: document.getElementById('tab-favorites'),
  live: document.getElementById('tab-live'),
  recent: document.getElementById('tab-recent'),
  soon: document.getElementById('tab-soon'),
  later: document.getElementById('tab-later'),
};
const multiFilters = [
  { menu: document.getElementById('category-menu'), options: document.getElementById('category-options'), summary: document.getElementById('category-summary'), eventProperty: 'categoryNames', allLabel: 'All categories', selectedLabel: 'categories' },
  { menu: document.getElementById('language-menu'), options: document.getElementById('language-options'), summary: document.getElementById('language-summary'), eventProperty: 'languageNames', allLabel: 'All languages', selectedLabel: 'languages' },
  { menu: document.getElementById('location-menu'), options: document.getElementById('location-options'), summary: document.getElementById('location-summary'), eventProperty: 'locationNames', allLabel: 'All locations', selectedLabel: 'locations' },
  { menu: document.getElementById('accessibility-menu'), options: document.getElementById('accessibility-options'), summary: document.getElementById('accessibility-summary'), eventProperty: 'accessibilityNames', allLabel: 'All accessibilities', selectedLabel: 'accessibilities' },
];

let allEvents = [];
let activeTab = 'program';
let programSortMode = 'start';
let filtersOpenedAt = 0;
let lastScrollY = window.scrollY;
let stickyDownScrollDistance = 0;
const RECENT_EVENT_WINDOW_MS = 60 * 60 * 1000;
const SOON_EVENT_WINDOW_MS = 60 * 60 * 1000;

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  const isLight = theme === 'light';
  $themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-moon" aria-hidden="true"></i>' : '<i class="fa-regular fa-sun" aria-hidden="true"></i>';
  const label = isLight ? 'Byt till mörkt läge' : 'Byt till ljust läge';
  $themeToggle.setAttribute('aria-label', label);
  $themeToggle.title = label;
}

setTheme(localStorage.getItem('theme') === 'light' ? 'light' : 'dark');

function eventStartTime(event) {
  return new Date(event.start || event.startTime || 0).getTime();
}

function eventEndTime(event) {
  return new Date(event.end || event.endTime || 0).getTime();
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
  const now = Date.now();
  const activeCount = allEvents.filter((event) => !event.isCancelled).length;
  const subeventCount = allEvents.filter((event) => event.type === 'subEvent').length;
  const cancelledCount = allEvents.filter((event) => event.isCancelled).length;
  const favoriteCount = allEvents.filter((event) => favorites.includes(idFor(event))).length;
  const liveCount = liveEvents(allEvents, now).length;
  const recentCount = eventsInWindow(allEvents, now - RECENT_EVENT_WINDOW_MS, now).length;
  const soonCount = eventsInWindow(allEvents, now, now + SOON_EVENT_WINDOW_MS).length;
  const laterCount = laterEvents(allEvents, now + SOON_EVENT_WINDOW_MS).length;

  tabs.program.querySelector('.event-count').textContent = String(activeCount);
  tabs.program.setAttribute('aria-label', `Alla ${activeCount}`);
  tabs.program.title = `Alla evenemang (${activeCount} st)`;
  tabs.subevent.querySelector('.subevent-count').textContent = String(subeventCount);
  tabs.subevent.setAttribute('aria-label', `Inslag ${subeventCount}`);
  tabs.subevent.title = `Del av evenemang (${subeventCount} st)`;
  tabs.cancelled.querySelector('.cancelled-count').textContent = String(cancelledCount);
  tabs.cancelled.setAttribute('aria-label', `Inställt ${cancelledCount}`);
  tabs.cancelled.title = `Inställda evenemang (${cancelledCount} st)`;
  tabs.favorites.querySelector('.favorite-count').textContent = String(favoriteCount);
  tabs.favorites.setAttribute('aria-label', `Favorit ${favoriteCount}`);
  tabs.favorites.title = `Favoritevenemang (${favoriteCount} st)`;
  tabs.live.querySelector('.live-count').textContent = String(liveCount);
  tabs.live.setAttribute('aria-label', `Nu ${liveCount}`);
  tabs.live.title = `Pågående evenemang (${liveCount} st)`;
  tabs.recent.querySelector('.recent-count').textContent = String(recentCount);
  tabs.recent.setAttribute('aria-label', `Nyss ${recentCount}`);
  tabs.recent.title = `Nyligen startade evenemang (${recentCount} st)`;
  tabs.soon.querySelector('.soon-count').textContent = String(soonCount);
  tabs.soon.setAttribute('aria-label', `Snart ${soonCount}`);
  tabs.soon.title = `Strax startade evenemang (${soonCount} st)`;
  tabs.later.querySelector('.later-count').textContent = String(laterCount);
  tabs.later.setAttribute('aria-label', `Sen ${laterCount}`);
  tabs.later.title = `Senare startade evenemang (${laterCount} st)`;
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
  return !$childrenFilter.checked || event.isForChildren === true;
}

function matchesFreeFilter(event) {
  return !$freeFilter.checked || event.isFree === true;
}

function clockMinutes(value) {
  const formattedTime = formatLocalClockTime(value);
  const match = formattedTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
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
  const endTime = clockMinutes(event.end || event.endTime || event.endTimeText) ?? startTime;
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
  $clearFilters.disabled = !$search.value && !$childrenFilter.checked && !$freeFilter.checked && !$fromFilter.value && !$toFilter.value && multiFilters.every((filter) => selectedFilterValues(filter).length === 0);
}

function updateFilterCount() {
  const selectedCount = multiFilters.reduce((count, filter) => count + selectedFilterValues(filter).length, 0) + ($search.value.trim() ? 1 : 0) + ($childrenFilter.checked ? 1 : 0) + ($freeFilter.checked ? 1 : 0) + ($fromFilter.value ? 1 : 0) + ($toFilter.value ? 1 : 0);
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
  if ($freeFilter.checked) selectedFilters.push('Gratis');
  for (const filter of multiFilters) selectedFilters.push(...selectedFilterValues(filter));
  if ($fromFilter.value) selectedFilters.push(`Från ${$fromFilter.value}`);
  if ($toFilter.value) selectedFilters.push(`Till ${$toFilter.value}`);
  const selectedFilterText = selectedFilters.length > 0 ? selectedFilters.join(', ') : 'Inga';
  $selectedFilters.replaceChildren();
  const label = document.createElement('span');
  label.className = 'filter-label';
  label.textContent = 'FILTER:';
  const values = document.createElement('span');
  values.textContent = ` ${selectedFilterText} (${filteredEventCount})`;
  $selectedFilters.append(label, values);
}

function closeFilters() {
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
    audience.textContent = `Målgrupp: ${ev.isForChildren ? 'Barn och vuxna' : 'Vuxna'}`;
    detailsList.appendChild(audience);
  }

  const languageNames = Array.isArray(ev.languageNames) ? ev.languageNames.filter(Boolean) : [];
  if (languageNames.length > 0) {
    const languages = document.createElement('li');
    languages.textContent = `Språk: ${languageNames.join(', ')}`;
    detailsList.appendChild(languages);
  }

  const accessibilityNames = Array.isArray(ev.accessibilityNames) ? ev.accessibilityNames.filter(Boolean) : [];
  if (accessibilityNames.length > 0) {
    const accessibility = document.createElement('li');
    accessibility.textContent = `Tillgänglighet: ${accessibilityNames.join(', ')}`;
    detailsList.appendChild(accessibility);
  }

  if (ev.organizer || ev.url) {
    const organizer = document.createElement('li');
    if (ev.organizer) organizer.textContent = 'Arrangör: ';
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
    if (ev.organizer && ev.url) organizer.appendChild(document.createTextNode(' | '));
    if (ev.url) {
      const eventPage = document.createElement('a');
      eventPage.href = ev.url;
      eventPage.target = '_blank';
      eventPage.rel = 'noopener noreferrer';
      eventPage.textContent = 'Evenemangsida';
      organizer.appendChild(eventPage);
    }
    detailsList.appendChild(organizer);
  }

  if (ev.streetAddress) {
    const address = document.createElement('li');
    address.textContent = `Address: ${ev.streetAddress}`;
    detailsList.appendChild(address);
  }

  const checked = formatLocalDateTime(ev.checked);
  if (checked) {
    const checkedAt = document.createElement('li');
    checkedAt.textContent = `Kontrollerad: ${checked}`;
    detailsList.appendChild(checkedAt);
  }

  const updated = formatLocalDateTime(ev.updated);
  if (updated) {
    const updatedAt = document.createElement('li');
    updatedAt.textContent = `Uppdaterad ${updated}`;
    detailsList.appendChild(updatedAt);
  }

  if (detailsList.childElementCount > 0) details.appendChild(detailsList);

  const mapQuery = coordinatesToMapQuery(ev.coordinates);
  if (mapQuery) {
    const mapToggle = document.createElement('button');
    mapToggle.type = 'button';
    mapToggle.className = 'map-toggle';
    mapToggle.textContent = 'Show map';
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
      mapToggle.textContent = map.hidden ? 'Show map' : 'Hide map';
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
    $list.innerHTML = '<div class="no-events">No events</div>';
    return;
  }
  let openCard = null;
  for (const ev of events) {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const timeLine = document.createElement('div');
    timeLine.className = 'line time-line';

    const startValue = formatLocalClockTime(ev.start || ev.startTime || ev.startTimeText || ev.time || '—');
    const endValue = ev.end || ev.endTime || ev.endTimeText ? formatLocalClockTime(ev.end || ev.endTime || ev.endTimeText) : null;
    const timeText = endValue ? `${startValue}–${endValue}` : startValue;

    const timeLabel = document.createElement('span');
    timeLabel.className = 'event-time';
    timeLabel.textContent = timeText;

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

    timeLine.appendChild(timeLabel);

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

    if (ev.isCancelled) {
      const cancelledBadge = document.createElement('div');
      cancelledBadge.className = 'cancelled-badge';
      cancelledBadge.textContent = 'INSTÄLLT';
      card.appendChild(cancelledBadge);
    }
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
  Object.values(tabs).forEach((b) => b.classList.remove('active'));
  tabs[tab].classList.add('active');
  $activeTabHeading.textContent = tabTooltip(tab);
  $programSortControls.hidden = tab !== 'program';
  const favs = loadFavorites();
  const now = Date.now();
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
  }
  const filteredEvents = events.filter(matchesSearch).filter(matchesChildrenFilter).filter(matchesFreeFilter).filter(matchesMultiFilters).filter(matchesTimeFilters);
  updateSelectedFilters(filteredEvents.length);
  renderList(filteredEvents);
}

tabs.program.addEventListener('click', () => setActive('program'));
tabs.subevent.addEventListener('click', () => setActive('subevent'));
tabs.cancelled.addEventListener('click', () => setActive('cancelled'));
tabs.favorites.addEventListener('click', () => setActive('favorites'));
tabs.live.addEventListener('click', () => setActive('live'));
tabs.recent.addEventListener('click', () => setActive('recent'));
tabs.soon.addEventListener('click', () => setActive('soon'));
tabs.later.addEventListener('click', () => setActive('later'));
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
  const openingFilters = $filterPanel.hidden;
  $filterPanel.hidden = !openingFilters;
  if (openingFilters) filtersOpenedAt = Date.now();
  $showFilters.setAttribute('aria-expanded', String(!$filterPanel.hidden));
  $showFilters.setAttribute('aria-pressed', String(!$filterPanel.hidden));
  updateShowFiltersButton();
});
$search.addEventListener('input', () => {
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
$childrenFilter.addEventListener('change', () => {
  updateClearFiltersButton();
  updateFilterCount();
  setActive(activeTab);
});
$freeFilter.addEventListener('change', () => {
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
  $freeFilter.checked = false;
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
