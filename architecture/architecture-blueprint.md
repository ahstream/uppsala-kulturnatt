Create a website that lists all events from https://kulturnatten.uppsala.se/

Events are fetched from API: https://kulturnatten.uppsala.se/api/events/search

Categories is fetched from https://kulturnatten.uppsala.se/api/events/filters?culture=sv

Site should cache all events in localstorage.

Site should cache all categories in localstorage.

Site should show cached events when started

Site should offer a "Update" button that fetches all events from API and sync with cached events. Should show a progress pointer.

Should fetch categories from https://kulturnatten.uppsala.se/api/events/filters?culture=sv

Should show category filters at top, with "All" showing all events, and one filter button for each category. When clicking a filter button, only events for that cateory should be shown. Only one filter button can be active. Selected filter button should be saved to localstorage and used as default next time. If no selected filter does not exist, show "All" as default

Each event listing should have a favorite icon that can be toggled.

Events should be shown sorted by start time. Events with same start time should sort on ascending end time.
