import { pragueEventDate } from '../shared/event-details/state.js';

function updateEventDetailLinks() {
  const plan = document.querySelector('[data-event-detail-plan]');
  if (!plan) return;

  const archive = document.querySelector('[data-event-detail-archive]');
  const archivedItems = archive?.querySelector('ul');
  const today = pragueEventDate();

  for (const item of plan.querySelectorAll('li[data-event-date]')) {
    if (archivedItems && item.dataset.eventDate < today) {
      archivedItems.append(item);
    } else {
      item.hidden = item.dataset.eventDate < today;
    }
  }
  plan.hidden = !plan.querySelector('li:not([hidden])');
  if (archive) archive.hidden = !archivedItems?.childElementCount;
}

updateEventDetailLinks();
window.addEventListener('pageshow', updateEventDetailLinks);
