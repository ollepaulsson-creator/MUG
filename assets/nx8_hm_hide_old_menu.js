var nx8HmHomSelector = null;
if (typeof NX8_HM_DATA === 'object' && typeof NX8_HM_DATA.settings == 'object' && NX8_HM_DATA.settings.display_method){
    if(NX8_HM_DATA.settings.display_method == 'auto' || NX8_HM_DATA.settings.display_method == 'menu_selector'){
        if (typeof window.nx8HmSelector !== 'undefined' && window.nx8HmSelector.desktop)
            nx8HmHomSelector = window.nx8HmSelector.desktop;
    }
    else if(NX8_HM_DATA.settings.display_method == 'css_selector' && NX8_HM_DATA.settings.css_selector){
        nx8HmHomSelector = NX8_HM_DATA.settings.css_selector
    }
}
if (nx8HmHomSelector){
    var nx8HomStyleEl = document.createElement('style');
    nx8HomStyleEl.setAttribute('id', 'h2mHOmCss');
    nx8HomStyleEl.setAttribute('type', 'text/css');
    nx8HomStyleEl.innerHTML = `@media (min-width: 769px) {
            ${nx8HmHomSelector}{
                opacity: 0!important;
            }
        }`;
    document.getElementsByTagName('head')[0].appendChild(nx8HomStyleEl);
}


