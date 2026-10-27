document.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("loader");
    window.addEventListener("load", () => {
        setTimeout(() => {
            if (loader) {
                loader.classList.add("loaded");
            }
        }, 1500);
    });
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");
    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            const isOpen =
                navLinks.classList.toggle("open");
            menuToggle.classList.toggle(
                "open",
                isOpen
            );
            menuToggle.setAttribute(
                "aria-expanded",
                isOpen
            );
            document.body.classList.toggle(
                "no-scroll",
                isOpen
            );
        });
        const links =
            navLinks.querySelectorAll("a");
        links.forEach(link => {
            link.addEventListener("click", () => {
                navLinks.classList.remove("open");
                menuToggle.classList.remove("open");
                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
                document.body.classList.remove(
                    "no-scroll"
                );
            });
        });
    }
    // Carga y reproducción diferida de videos (mejora Performance/TBT en Lighthouse)
    const lazyVideos =
        document.querySelectorAll("video[data-src]");
    if (lazyVideos.length) {
        const videoObserver =
            new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        const video = entry.target;
                        if (entry.isIntersecting) {
                            if (!video.src) {
                                video.src = video.dataset.src;
                                video.load();
                            }
                            video.play().catch(() => {});
                        } else {
                            video.pause();
                        }
                    });
                },
                {
                    rootMargin: "200px 0px",
                    threshold: 0.15
                }
            );
        lazyVideos.forEach(video => {
            videoObserver.observe(video);
        });
    }

    const revealElements =
        document.querySelectorAll(".reveal");
    const revealObserver =
        new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add(
                            "visible"
                        );
                        revealObserver.unobserve(
                            entry.target
                        );
                    }
                });
            },
            {
                threshold: 0.12
            }
        );
    revealElements.forEach(element => {
        revealObserver.observe(element);
    });
    const filterGroups =
        document.querySelectorAll(".filters");
    filterGroups.forEach(filterGroup => {
        const parentSection =
            filterGroup.closest("section");
        if (!parentSection) return;
        const filters =
            filterGroup.querySelectorAll(".filter");
        const cards =
            parentSection.querySelectorAll("[data-category]");
        filters.forEach(filter => {
            filter.addEventListener("click", () => {
                const category =
                    filter.dataset.filter;
                filters.forEach(button => {
                    button.classList.remove(
                        "active"
                    );
                });
                filter.classList.add("active");
                cards.forEach(card => {
                    const cardCategory =
                        card.dataset.category;
                    if (
                        category === "all" ||
                        (cardCategory && cardCategory.split(" ").includes(category))
                    ) {
                        card.classList.remove(
                            "hidden"
                        );
                    } else {
                        card.classList.add(
                            "hidden"
                        );
                    }
                });
            });
        });
    });
    const internalLinks =
        document.querySelectorAll(
            'a[href^="#"]'
        );
    internalLinks.forEach(link => {
        link.addEventListener("click", (event) => {
            const targetId =
                link.getAttribute("href");
            const target =
                document.querySelector(targetId);
            if (target) {
                event.preventDefault();
                const targetReveals =
                    target.classList.contains("reveal")
                        ? [target, ...target.querySelectorAll(".reveal")]
                        : target.querySelectorAll(".reveal");
                targetReveals.forEach(element => {
                    element.classList.remove("visible");
                });
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                setTimeout(() => {
                    targetReveals.forEach(element => {
                        element.classList.add("visible");
                    });
                }, 500);
            }
        });
    });
    const heroVisual =
        document.querySelector(".visual-card");
    if (heroVisual && window.innerWidth > 900) {
        document.addEventListener(
            "mousemove",
            (event) => {
                const x =
                    (event.clientX /
                    window.innerWidth - .5);
                const y =
                    (event.clientY /
                    window.innerHeight - .5);
                heroVisual.style.transform =
                    `
                    rotateX(${y * -4}deg)
                    rotateY(${x * 4}deg)
                    rotateZ(2deg)
                    `;
            }
        );
    }
    const navbar =
        document.querySelector(".navbar");
    window.addEventListener(
        "scroll",
        () => {
            if (!navbar) return;
            if (window.scrollY > 50) {
                navbar.style.background =
                    "rgba(8,8,11,.85)";
            } else {
                navbar.style.background =
                    "rgba(10,10,13,.65)";
            }
        },
        {
            passive: true
        }
    );
    const contactForm =
        document.getElementById("contactForm");
    const formSuccess =
        document.getElementById("formSuccess");
    if (contactForm) {
        contactForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }
            if (formSuccess) {
                formSuccess.classList.add("visible");
            }
            contactForm.reset();
        });
    }
    const newsletterForm =
        document.getElementById("newsletterForm");
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const input =
                newsletterForm.querySelector("input");
            if (input) {
                input.value = "";
                input.placeholder = "¡Listo, ya estás suscrito!";
            }
        });
    }
    document.querySelectorAll(".project-card")
        .forEach((card, index) => {
            card.style.transitionDelay =
                `${index * 80}ms`;
        });
});
