import { pragueEventDate } from '../shared/event-details/state.js';

function updateEventDetailLinks() {
  const archive = document.querySelector('[data-event-detail-archive]');
  const archivedItems = archive?.querySelector('ul');
  if (!archivedItems) return;
  const today = pragueEventDate();

  for (const card of document.querySelectorAll('[data-event-archive-date]')) {
    if (card.dataset.eventArchiveDate >= today) continue;
    const detail = card.querySelector('a.event-title-action[href]');
    if (!detail) continue;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = detail.href;
    link.textContent = detail.textContent.trim();
    item.append(link);
    archivedItems.append(item);
    card.remove();
  }
  archive.hidden = !archivedItems.childElementCount;
}

updateEventDetailLinks();
window.addEventListener('pageshow', updateEventDetailLinks);
