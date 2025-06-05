// URL ke zdroji dat
const DATA_URL = "/data/events.json";

let allEvents = [];

const renderEventCard = (event) => {
  return `
    <div class="event-card">
      <img src="${event.image}" alt="${event.name}" onerror="this.onerror=null; this.src='https://picsum.photos/600/400?grayscale&blur';" />
      <div class="event-info">
        <h3>${event.name}</h3>
        <p><strong>Datum:</strong> ${event.date}</p>
        <p><strong>Místo:</strong> ${event.location}</p>
        <a href="event-detail.html?id=${event.id}" class="btn-small">Zobrazit detail</a>
      </div>
    </div>
  `;
};

const renderEvents = (events, containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = events.map(renderEventCard).join("");
};

const applyFilters = () => {
  const searchValue = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const selectedCategory = document.getElementById("categoryFilter")?.value || "";

  const filtered = allEvents.filter((event) => {
    const matchesText =
      event.name.toLowerCase().includes(searchValue) ||
      event.location.toLowerCase().includes(searchValue) ||
      event.description.toLowerCase().includes(searchValue);

    const matchesCategory =
      !selectedCategory || event.category === selectedCategory;

    return matchesText && matchesCategory;
  });

  renderEvents(filtered, "all-events");
};

fetch(DATA_URL)
  .then((response) => response.json())
  .then((data) => {
    allEvents = data;

    if (document.getElementById("preview-events")) {
      const preview = data.slice(0, 3);
      renderEvents(preview, "preview-events");
    }

    if (document.getElementById("all-events")) {
      renderEvents(data, "all-events");

      document.getElementById("searchInput")?.addEventListener("input", applyFilters);
      document.getElementById("categoryFilter")?.addEventListener("change", applyFilters);
    }
  })
  .catch((err) => {
    console.error("Chyba při načítání událostí:", err);
  });
