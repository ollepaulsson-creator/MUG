/* QIKIFY AUTO HIDE START */
var qikifySmSelectors = {
    Alchemy: ".nav-row ul",
    Artisan: ".mainMenu",
    Atlantic: ".main-header--nav-links",
    Avenue: "#responsiveMenu.isDesktop",
    Blockshop: ".x-menu--level-1--container",
    Boost: ".nav.site-nav",
    Boundless: ".drawer-nav",
    Broadcast: ".main-menu",
    Brooklyn: "#AccessibleNav",
    Canopy: ".main-nav > ul",
    Capital: ".navigation-list",
    Cascade: ".site-nav",
    Context: ".header__nav > ul",
    Debut: "#SiteNav",
    District: ".nav-bar .site-nav",
    Editions: ".navigation-desktop",
    Empire: ".site-navigation > .navmenu",
    Envy: "#main-navigation-wrapper .nav",
    Express: "#shopify-section-header .menu-navigation",
    Expression: ".main-nav",
    Fashionopolism: ".navigation__maincontainer > #nav",
    Flow: ".site-nav.mega-menu-wrapper",
    Galleria: ".nav-standard-nav-area .nav",
    Grid: ".navigation-menu",
    Handy: ".site-navigation > .navmenu",
    Icon: "#main-nav",
    Impulse: ".site-navigation",
    Ira: ".header__links-list",
    Kingdom: ".sidebar__menu.sidebar--primary",
    Launch: "#header-navigation > ul",
    Loft: "#AccessibleNav",
    Lorenza: ".header__nav .list",
    Masonry: ".mainnav ul",
    Minimal: "#AccessibleNav",
    Mobilia: ".mobile_hidden .menu",
    Modular: ".nav-main > .menu",
    Motion: ".site-navigation",
    Narrative: ".navigation__container .navigation__links:first-child",
    Pacific: ".navmenu",
    Parallax: ".header__navigation",
    Pipeline: ".header__desktop__bar__inline .header__menu",
    Prestige: ".Header__MainNav .HorizontalList",
    Providence: ".menu > ul ",
    Reach: ".site-header:not(.site-navigation-layout-drawer) .navmenu",
    Responsive: ".menu-navigation",
    Retina: ".header .menu",
    Simple: "#SiteNav > .list--nav",
    Showcase: ".nav-row > .tier-1 > ul",
    Showtime: ".mega_menu",
    Split: ".link-list",
    Startup: ".navigation > ul",
    Story: ".main-menu",
    Streamline: ".site-navigation",
    Sunrise: ".top-menu > ul",
    Supply: "#AccessibleNav",
    Symmetry: ".navigation__tier-1",
    Testament: "#main-nav",
    Trademark: ".header__main-nav > .header__links",
    Vantage: "#main-nav",
    Venue: ".primary-nav__items",
    Venture: "#SiteNav",
    Vogue: ".main-navigation-menu .navigation-menu",
    Warehouse: ".nav-bar__linklist",
};

var qikifySmTheme = window.Shopify.theme.name;
var qikifySmSelector = Object.keys(qikifySmSelectors).find(function(s) { return new RegExp(s, "gi").test(qikifySmTheme); });

if (qikifySmSelector) {
    var qikifySmStyle = "@media (min-width: 769px) { " + qikifySmSelectors[qikifySmSelector] + " { opacity: 0; }; }";
    var qikifySmStyleElement = document.createElement("style");

    qikifySmStyleElement.setAttribute("id", "qikify-auto-hide");
    qikifySmStyleElement.setAttribute("type", "text/css");
    qikifySmStyleElement.appendChild(document.createTextNode(qikifySmStyle));
    document.getElementsByTagName("head")[0].appendChild(qikifySmStyleElement);
}
/* QIKIFY AUTO HIDE END */