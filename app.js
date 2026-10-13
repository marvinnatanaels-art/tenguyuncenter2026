(() => {
  "use strict";

  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const photos = window.TFO_PHOTOS || [];
  const albumDialog = document.getElementById("albumDialog");
  const photoDialog = document.getElementById("photoDialog");
  const albumGrid = document.getElementById("albumGrid");
  const categoryFilter = document.getElementById("categoryFilter");
  const photoSearch = document.getElementById("photoSearch");
  const albumCount = document.getElementById("albumCount");
  const albumEmpty = document.getElementById("albumEmpty");
  const loadMore = document.getElementById("loadMore");
  const albumDrive = document.getElementById("albumDrive");
  const fullPhoto = document.getElementById("fullPhoto");
  const sharePhoto = document.getElementById("sharePhoto");
  const toast = document.getElementById("toast");
  const PAGE_SIZE = 24;
  const DRIVE_DOCUMENTATION = {
    "DAY 1":
      "https://drive.google.com/drive/folders/1M2yFnXW7OPHNRb9miuUFDxFhgM5SUqj_",
    "DAY 2":
      "https://drive.google.com/drive/folders/18kJiUraTiRTzNoCSgGoy_ARK-r0cfwEb",
    "DAY 3":
      "https://drive.google.com/drive/folders/1WeDSqCh32NDLk9aqE75IZaY9p2k5WWBM",
    "DAY 4":
      "https://drive.google.com/drive/folders/1rzLxzTgJBWZKXfbCE-nz5tZLbbTJl7o7",
  };
  const DRIVE_PRIZES =
    "https://drive.google.com/drive/folders/1ROeA4fDskuL1z55AOhLka3-bzk2w-XoW";

  let currentPhotos = [];
  let filteredPhotos = [];
  let visibleCount = 0;
  let viewerPhotos = [];
  let photoIndex = 0;
  let savedBodyOverflow = null;
  let toastTimeout;

  function assetUrl(src) {
    return src.split("/").map(encodeURIComponent).join("/");
  }

  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("id")
      .trim();
  }

  // Mobile navigation and persistent color theme.
  const menuButton = document.getElementById("menuButton");
  const mobileNav = document.getElementById("mobileNav");

  function closeNavigation() {
    mobileNav.classList.remove("active");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Buka navigasi");
  }

  menuButton.addEventListener("click", () => {
    const open = mobileNav.classList.toggle("active");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Tutup navigasi" : "Buka navigasi",
    );
  });
  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNavigation);
  });

  const themeButton = document.getElementById("themeToggle");
  function setTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute(
      "aria-label",
      theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang",
    );
    themeButton.setAttribute("aria-pressed", String(theme === "dark"));
    document.querySelector('meta[name="theme-color"]').content =
      theme === "dark" ? "#241333" : "#ffe000";
  }
  try {
    setTheme(localStorage.getItem("tfo-theme") === "dark" ? "dark" : "light");
  } catch {
    setTheme("light");
  }
  themeButton.addEventListener("click", () => {
    const theme = root.dataset.theme === "light" ? "dark" : "light";
    setTheme(theme);
    try {
      localStorage.setItem("tfo-theme", theme);
    } catch {
      // The theme still works when storage is unavailable.
    }
  });

  // Each track has two identical groups for a seamless photo loop.
  document.querySelectorAll(".photo-track").forEach((track) => {
    const set = track.querySelector(".photo-set");
    if (!set) return;
    const clone = set.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    clone.querySelectorAll("img").forEach((image) => {
      image.alt = "";
    });
    [set, clone].forEach((group) => {
      group.querySelectorAll("img").forEach((image) => {
        image.loading = "eager";
        image.decoding = "async";
      });
    });
    track.append(clone);
  });

  const marquee = document.querySelector(".marquee");
  if (marquee) {
    const group = document.createElement("div");
    group.className = "marquee-group";
    while (marquee.firstChild) group.append(marquee.firstChild);
    const clone = group.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    marquee.append(group, clone);
  }

  // Keep the hero paused and the page locked while ANY dialog remains open.
  function syncDialogState() {
    const open = albumDialog.open || photoDialog.open;
    hero.classList.toggle("dialog-paused", open);
    if (open && savedBodyOverflow === null) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else if (!open && savedBodyOverflow !== null) {
      document.body.style.overflow = savedBodyOverflow;
      savedBodyOverflow = null;
    }
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    syncDialogState();
  }

  [albumDialog, photoDialog].forEach((dialog) => {
    dialog.addEventListener("close", syncDialogState);
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        dialog.close();
      }
    });
  });
  document
    .getElementById("closeAlbum")
    .addEventListener("click", () => albumDialog.close());
  document
    .getElementById("closePhoto")
    .addEventListener("click", () => photoDialog.close());

  function renderMore() {
    const nextPhotos = filteredPhotos.slice(
      visibleCount,
      visibleCount + PAGE_SIZE,
    );
    const fragment = document.createDocumentFragment();
    nextPhotos.forEach((item, offset) => {
      const index = visibleCount + offset;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "album-photo loading";
      button.setAttribute("aria-label", "Lihat " + item.label);
      const image = document.createElement("img");
      image.alt = item.label;
      image.loading = "lazy";
      image.decoding = "async";
      const label = document.createElement("span");
      label.textContent = item.label;

      const finishLoading = () => button.classList.remove("loading");
      image.addEventListener("load", finishLoading, { once: true });
      image.addEventListener(
        "error",
        () => {
          finishLoading();
          button.classList.add("image-error");
          label.textContent = item.label + " — Foto tidak dapat dimuat";
        },
        { once: true },
      );
      image.src = assetUrl(item.src);
      if (image.complete && image.naturalWidth > 0) finishLoading();

      button.append(image, label);
      button.addEventListener("click", () => showPhoto(filteredPhotos, index));
      fragment.append(button);
    });
    albumGrid.append(fragment);
    visibleCount += nextPhotos.length;
    loadMore.hidden = visibleCount >= filteredPhotos.length;
    albumEmpty.hidden = filteredPhotos.length > 0;
    albumCount.textContent = filteredPhotos.length + " foto";
  }

  function applyFilter() {
    const keywords = normalize(photoSearch.value).split(/\s+/).filter(Boolean);
    filteredPhotos = currentPhotos.filter((item) => {
      const matchesCategory =
        !categoryFilter.value || item.category === categoryFilter.value;
      const description = normalize(
        [item.label, item.title, item.description, item.category, item.group]
          .filter(Boolean)
          .join(" "),
      );
      return (
        matchesCategory &&
        keywords.every((keyword) => description.includes(keyword))
      );
    });
    visibleCount = 0;
    albumGrid.replaceChildren();
    renderMore();
  }

  function openAlbum(name) {
    currentPhotos = photos.filter((item) => item.group === name);
    document.getElementById("albumTitle").textContent = name;
    categoryFilter.replaceChildren(new Option("Semua kegiatan", ""));
    [...new Set(currentPhotos.map((item) => item.category))].forEach(
      (category) => {
        categoryFilter.add(new Option(category, category));
      },
    );
    photoSearch.value = "";
    const prizes = name === "Pembagian Juara";
    albumDrive.href = prizes ? DRIVE_PRIZES : DRIVE_DOCUMENTATION[name];
    albumDrive.textContent = prizes
      ? "Buka Drive Pembagian Hadiah ↗"
      : `Dokumentasi ${name} ↗`;
    applyFilter();
    openDialog(albumDialog);
    albumDialog.scrollTop = 0;
  }

  document.querySelectorAll("[data-album]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openAlbum(link.dataset.album);
    });
  });
  categoryFilter.addEventListener("change", applyFilter);
  photoSearch.addEventListener("input", applyFilter);
  loadMore.addEventListener("click", renderMore);

  function updatePhoto() {
    const item = viewerPhotos[photoIndex];
    if (!item) return;
    fullPhoto.src = assetUrl(item.src);
    fullPhoto.alt = item.label;
    document.getElementById("photoCaption").textContent =
      `${item.group} · ${item.label} (${photoIndex + 1}/${viewerPhotos.length})`;
    const download = document.getElementById("downloadPhoto");
    download.href = assetUrl(item.src);
    download.download = item.src.split("/").pop();
    document.getElementById("prevPhoto").disabled = viewerPhotos.length < 2;
    document.getElementById("nextPhoto").disabled = viewerPhotos.length < 2;
  }

  function showPhoto(list, index) {
    if (!list.length || !list[index]) return;
    viewerPhotos = list;
    photoIndex = index;
    toast.hidden = true;
    updatePhoto();
    openDialog(photoDialog);
  }

  function stepPhoto(delta) {
    if (!viewerPhotos.length) return;
    photoIndex =
      (photoIndex + delta + viewerPhotos.length) % viewerPhotos.length;
    updatePhoto();
  }
  document
    .getElementById("prevPhoto")
    .addEventListener("click", () => stepPhoto(-1));
  document
    .getElementById("nextPhoto")
    .addEventListener("click", () => stepPhoto(1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavigation();
    if (!photoDialog.open || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      stepPhoto(event.key === "ArrowLeft" ? -1 : 1);
    }
  });

  function showToast(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.hidden = false;
    toastTimeout = setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }

  async function copyPhotoLink(link) {
    if (!navigator.clipboard?.writeText) {
      showToast("Penyalinan tidak tersedia. Gunakan browser dengan HTTPS.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      showToast("Tautan foto berhasil disalin.");
    } catch {
      showToast(
        "Tautan belum tersalin. Izinkan akses clipboard lalu coba lagi.",
      );
    }
  }

  sharePhoto.addEventListener("click", async () => {
    const item = viewerPhotos[photoIndex];
    if (!item || sharePhoto.disabled) return;
    const origin =
      document.querySelector('meta[name="site-url"]')?.content || location.href;
    const link = new URL(assetUrl(item.src), origin).href;
    const data = {
      title: "Tenguyun Fest 2026 — " + item.label,
      text: item.group + " · " + item.label,
      url: link,
    };
    sharePhoto.disabled = true;
    try {
      if (
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare(data))
      ) {
        try {
          await navigator.share(data);
          showToast("Foto berhasil dibagikan.");
        } catch (error) {
          if (error.name !== "AbortError") await copyPhotoLink(link);
        }
      } else {
        await copyPhotoLink(link);
      }
    } finally {
      sharePhoto.disabled = false;
    }
  });
  photoDialog.addEventListener("close", () => {
    toast.hidden = true;
    clearTimeout(toastTimeout);
  });

  // Make existing highlight cards keyboard-accessible lightbox triggers.
  const highlightCards = [...document.querySelectorAll(".gallery-item")];
  const findPhoto = (element) =>
    photos.find(
      (item) =>
        item.src ===
        element.querySelector("img").getAttribute("src").replace(/^\.\//, ""),
    );
  const highlights = highlightCards.map(findPhoto).filter(Boolean);
  highlightCards.forEach((element) => {
    const item = findPhoto(element);
    if (!item) return;
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      "Perbesar foto " + element.querySelector("figcaption").textContent,
    );
    const hint = document.createElement("span");
    hint.textContent = "Lihat foto ↗";
    element.querySelector("figcaption").append(hint);
    const open = () => showPhoto(highlights, highlights.indexOf(item));
    element.addEventListener("click", open);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  // Floating button appears only after scrolling beyond 300px.
  const backToTop = document.getElementById("backToTop");
  function updateBackToTop() {
    backToTop.hidden = window.scrollY <= 300;
  }
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();
  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  });

  // Count each metric once, when the group enters the viewport.
  const metrics = document.querySelector(".hero-metrics");
  const counters = [...metrics.querySelectorAll("strong")];
  function animateCounter(element) {
    const target = Number(element.dataset.countTarget);
    if (reducedMotion.matches) {
      element.textContent = String(target);
      return;
    }
    const started = performance.now();
    const duration = 1200;
    function tick(now) {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    counters.forEach((element) => {
      element.dataset.countTarget = element.textContent.trim();
      element.setAttribute("aria-label", element.textContent.trim());
      element.textContent = "0";
    });
    const counterObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        counterObserver.disconnect();
        counters.forEach(animateCounter);
      },
      { threshold: 0.2 },
    );
    counterObserver.observe(metrics);
  }

  // Scrollspy follows visible sections for both navigation layouts.
  const navigationLinks = [
    ...document.querySelectorAll(".desktop-nav a, .mobile-nav a"),
  ];
  const sections = [
    ...new Set(
      navigationLinks.map((link) =>
        document.querySelector(link.getAttribute("href")),
      ),
    ),
  ].filter(Boolean);
  function setActiveSection(id) {
    navigationLinks.forEach((link) => {
      const active = link.getAttribute("href") === "#" + id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  if ("IntersectionObserver" in window) {
    const visibleSections = new Set();
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleSections.add(entry.target);
          else visibleSections.delete(entry.target);
        });
        const active = [...visibleSections].sort(
          (a, b) =>
            Math.abs(a.getBoundingClientRect().top - 100) -
            Math.abs(b.getBoundingClientRect().top - 100),
        )[0];
        setActiveSection(active?.id || "");
      },
      { rootMargin: "-84px 0px -45% 0px", threshold: [0, 0.1, 0.35, 0.6] },
    );
    sections.forEach((section) => sectionObserver.observe(section));
  }
})();
