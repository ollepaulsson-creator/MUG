var ETS_MM_INIT = 1;
var ETS_MM_SETUP = 0;
if (typeof jQuery !== 'undefined' && typeof etsMM !== 'undefined' && etsMM){
    try {
        etsMM.initMenu();
        etsMM.setStyleOverlay();
        ETS_MM_SETUP=1;
    }
    catch (e) {

    }
}
