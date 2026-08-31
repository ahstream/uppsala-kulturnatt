const DATA_PATH = '../../data/packedEvents.json';

const $header = document.querySelector('header');
const $status = document.getElementById('status');
const $list = document.getElementById('list');
const $search = document.getElementById('event-search');
const $clearFilters = document.getElementById('clear-filters');
const $childrenFilter = document.getElementById('children-filter');
const $freeFilter = document.getElementById('free-filter');
const $showFilters = document.getElementById('show-filters');
const $filterPanel = document.getElementById('filter-panel');
const $filterCount = document.getElementById('filter-count');
const $filteredEvents = document.getElementById('filtered-events');
const tabs = {
  program: document.getElementById('tab-program'),
  favorites: document.getElementById('tab-favorites'),
  live: document.getElementById('tab-live'),
};
const multiFilters = [
  { menu: document.getElementById('category-menu'), options: document.getElementById('category-options'), summary: document.getElementById('category-summary'), eventProperty: 'categoryNames', allLabel: 'All categories', selectedLabel: 'categories' },
  { menu: document.getElementById('language-menu'), options: document.getElementById('language-options'), summary: document.getElementById('language-summary'), eventProperty: 'languageNames', allLabel: 'All languages', selectedLabel: 'languages' },
  { menu: document.getElementById('location-menu'), options: document.getElementById('location-options'), summary: document.getElementById('location-summary'), eventProperty: 'locationNames', allLabel: 'All locations', selectedLabel: 'locations' },
  { menu: document.getElementById('accessibility-menu'), options: document.getElementById('accessibility-options'), summary: document.getElementById('accessibility-summary'), eventProperty: 'accessibilityNames', allLabel: 'All accessibilities', selectedLabel: 'accessibilities' },
];

let allEvents = [];
let activeTab = 'program';
let filtersOpenedAt = 0;

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
  const activeCount = allEvents.filter((event) => !event.isCancelled).length;
  const favoriteCount = allEvents.filter((event) => favorites.includes(idFor(event))).length;

  tabs.program.querySelector('.event-count').textContent = `(${activeCount})`;
  tabs.program.setAttribute('aria-label', `Event (${activeCount})`);
  tabs.program.title = `Event (${activeCount})`;
  tabs.favorites.querySelector('.favorite-count').textContent = `(${favoriteCount})`;
  tabs.favorites.setAttribute('aria-label', `Favoriter (${favoriteCount})`);
  tabs.favorites.title = `Favoriter (${favoriteCount})`;
  tabs.live.querySelector('.live-count').textContent = '(0)';
  tabs.live.setAttribute('aria-label', 'Live (0)');
  tabs.live.title = 'Live (0)';
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

  return [event.title, event.parentTitle, event.type === 'event' ? event.about : null].some((value) =>
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

function updateClearFiltersButton() {
  $clearFilters.disabled = !$search.value && !$childrenFilter.checked && !$freeFilter.checked && multiFilters.every((filter) => selectedFilterValues(filter).length === 0);
}

function updateFilterCount() {
  const selectedCount = multiFilters.reduce((count, filter) => count + selectedFilterValues(filter).length, 0) + ($search.value.trim() ? 1 : 0) + ($childrenFilter.checked ? 1 : 0) + ($freeFilter.checked ? 1 : 0);
  const countLabel = selectedCount > 0 ? ` (${selectedCount})` : '';
  $filterCount.textContent = countLabel;
  $showFilters.setAttribute('aria-label', `Show filters${countLabel}`);
  $showFilters.title = `Show filters${countLabel}`;
}

function closeFilters() {
  $filterPanel.hidden = true;
  $showFilters.setAttribute('aria-expanded', 'false');
  $showFilters.setAttribute('aria-pressed', 'false');
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
        const tag = document.createElement('span');
        tag.className = 'chip';
        tag.textContent = category;
        categories.appendChild(tag);
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

    const titleText = document.createElement('span');
    titleText.className = 'event-title';
    const eventTitle = ev.title || ev.name || ev.displayName || 'Untitled';
    titleText.textContent = eventTitle;

    timeLine.appendChild(document.createTextNode(`${timeText} `));
    timeLine.appendChild(titleText);

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
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'chip';
      tag.textContent = category;
      tags.appendChild(tag);
    }

    const star = document.createElement('span');
    star.className = 'star';
    star.setAttribute('role', 'button');
    star.tabIndex = 0;
    star.setAttribute('aria-label', 'Toggle favorite');
    const favs = loadFavorites();
    const myid = idFor(ev);
    const active = favs.includes(myid);
    star.innerText = active ? '★' : '☆';
    star.setAttribute('aria-pressed', String(active));
    if (!active) star.classList.add('inactive');
    star.onclick = () => {
      const cur = loadFavorites();
      const i = cur.indexOf(myid);
      if (i === -1) cur.push(myid);
      else cur.splice(i, 1);
      saveFavorites(cur);
      updateTabCounts();
      star.innerText = cur.includes(myid) ? '★' : '☆';
      star.classList.toggle('inactive', !cur.includes(myid));
      star.setAttribute('aria-pressed', String(cur.includes(myid)));
    };
    star.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        star.click();
      }
    });
    timeLine.appendChild(star);
    timeLine.title = `${timeText} ${titleText.textContent}`;

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
    if (parentLine) card.appendChild(parentLine);
    if (locationLine.textContent) card.appendChild(locationLine);
    card.appendChild(tags);
    $list.appendChild(card);
  }
}

function setActive(tab) {
  activeTab = tab;
  Object.values(tabs).forEach((b) => b.classList.remove('active'));
  tabs[tab].classList.add('active');
  const favs = loadFavorites();
  let events = [];
  if (tab === 'program') {
    events = allEvents.filter((event) => !event.isCancelled);
  } else if (tab === 'favorites') {
    events = allEvents.filter((event) => favs.includes(idFor(event)));
  }
  const filteredEvents = events.filter(matchesSearch).filter(matchesChildrenFilter).filter(matchesFreeFilter).filter(matchesMultiFilters);
  $filteredEvents.textContent = `Filtered events: ${filteredEvents.length}`;
  renderList(filteredEvents);
}

tabs.program.addEventListener('click', () => setActive('program'));
tabs.favorites.addEventListener('click', () => setActive('favorites'));
tabs.live.addEventListener('click', () => setActive('live'));
$showFilters.addEventListener('click', () => {
  const openingFilters = $filterPanel.hidden;
  $filterPanel.hidden = !openingFilters;
  if (openingFilters) filtersOpenedAt = Date.now();
  $showFilters.setAttribute('aria-expanded', String(!$filterPanel.hidden));
  $showFilters.setAttribute('aria-pressed', String(!$filterPanel.hidden));
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
window.addEventListener(
  'scroll',
  () => {
    if (!$filterPanel.hidden && Date.now() - filtersOpenedAt > 200) closeFilters();
  },
  { passive: true },
);
$clearFilters.addEventListener('click', () => {
  $search.value = '';
  $childrenFilter.checked = false;
  $freeFilter.checked = false;
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
