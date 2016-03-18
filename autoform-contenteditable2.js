// TODO: крестик в contenteditable, чтобы сбросить редактируемый текст к data-initial-value
// TODO: галочку в contenteditable, чтобы отправить редактируемый текст в форму
// TODO: popup в contenteditable, когда текст выделен, с кнопками для комманд ctrl+b, ctrl+i, ctrl+u (см. MediumEditor.setToolbarPosition)
// TODO: команду на зачеркивание в contenteditable (<s>)
// TODO: индикатор ожидания записи для autosave, или это не работает Latency Compensation?
// TODO: autosave - it blocks the interface: https://github.com/aldeed/meteor-autoform/issues/645
// TODO: манипуляция выделением https://github.com/JackAdams/meteor-editable-text-wysiwyg/blob/master/lib/wysiwyg.js#L9
// TODO: hot keys https://github.com/jeresig/jquery.hotkeys
// FIXME: курсор перескакивает на пару пикселей выше, когда поле ввода пустое

/* support of $.browser
var matched, browser;

jQuery.uaMatch = function( ua ) {
    ua = ua.toLowerCase();

    var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
        /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
        /(msie)[\s?]([\w.]+)/.exec( ua ) ||
        /(trident)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
        [];

    return {
        browser: match[ 1 ] || "",
        version: match[ 2 ] || "0"
    };
};

matched = jQuery.uaMatch( navigator.userAgent );
//IE 11+ fix (Trident)
matched.browser = matched.browser == 'trident' ? 'msie' : matched.browser;
browser = {};

if ( matched.browser ) {
    browser[ matched.browser ] = true;
    browser.version = matched.version;
}

// Chrome is Webkit, but Webkit is also Safari.
if ( browser.chrome ) {
    browser.webkit = true;
} else if ( browser.webkit ) {
    browser.safari = true;
}

jQuery.browser = browser;
*/

AutoForm.addInputType("contenteditable2", {
  template: "afContenteditable2",
  // valueIn: function (value) {
  //   return value.replace(/\n/g, "<br>");
  // },
  valueOut: function () {
    // var $ce = $("<pre />").html(this.html());
    // if ($.browser.webkit)
    //   $ce.find("div").replaceWith(function() { return "\n" + this.innerHTML; });
    // if ($.browser.msie)
    //   $ce.find("p").replaceWith(function() { return this.innerHTML + "<br>"; });
    // // if ($.browser.mozilla || $.browser.opera || $.browser.msie)
    //   $ce.find("br").replaceWith("\n");
    // return $ce.text();
    // XXX use https://github.com/yabwe/medium-editor
    return this.html();
  },
  contextAdjust: function (context) {
    if (typeof context.atts["data-maxlength"] === "undefined" && typeof context.max === "number") {
      context.atts["data-maxlength"] = context.max;
    }
    if (context.atts["placeholder"]) {
      context.atts["data-placeholder"] = context.atts["placeholder"];
      delete context.atts["placeholder"];
    }
    context.atts['title'] = defaults.title;
    return context;
  }
});

Template.afContenteditable2.helpers({
  out: function () {
    var atts = this.atts;
    // TODO: if (style == 'bootstrap3') ...
    // Add bootstrap class
    atts = AutoForm.Utility.addClass(atts, "form-control");
    var s = "";
    for (key in atts) {
      s += ' ' + key + '="' + atts[key] + '"';
    }
    // BUGFIX: https://github.com/aldeed/meteor-autoform/issues/383
    return '<div contenteditable="true"' + s + '>' + this.value + '</div>';
  }
});

Template.afContenteditable2.events({
  "blur [contenteditable]": function (event, template) {
    var $element = template.$(event.target);
    $element.attr('title', $element.data('title'));
    $element.data('title', '');
    if ($element.tooltip) {
      $element.tooltip();
    }
    var pollTimeout = $element.data("poll-timeout");
    if (pollTimeout) {
      $element.data("poll-timeout", false);
      clearTimeout(pollTimeout);
    }
    // placeholder issue: http://stackoverflow.com/a/27755631/4315996
    if ($element.html().length && !$element.text().trim().length) {
        $element.empty();
    }
    var initial = $element.data("initial-value");
    var current = $element.html();
    if (initial != current) {
      $element.change();
    }
    // field may lost value: https://github.com/aldeed/meteor-autoform/issues/590
  },
  "focus [contenteditable]": function (event, template) {
    var $element = template.$(event.target);
    $element.data('title', $element.attr('title'));
    $element.attr('title', '');
    if ($element.tooltip) {
      $element.tooltip('destroy');
    }
    $element.data("initial-value", $element.html());
    $element.data("previous-value", $element.html());
    function checkForContentChanged() {
      var previous = $element.data("previous-value");
      var current = $element.html();
      if (previous != current) {
        $element.trigger("input2"); // final event - change
        $element.data("previous-value", current);
      }
      $element.data("poll-timeout", setTimeout(checkForContentChanged, 300));
    }
    $element.data("poll-timeout", setTimeout(checkForContentChanged, 300));
  },
  "keyup [contenteditable]": function (event, template) {
    // [esc] support
    if (event.which === 27) {
      var $element = template.$(event.target);
      $element.html($element.data("initial-value"));
      $element.blur();
    }
  },
  "input2 [contenteditable]": function (event, template) {
    var $element = template.$(event.target);
    try {
      localStorage.setItem($element.attr("draft_id"), $element.html());
    } catch(e) {}
  },
  "change [contenteditable]": function (event, template) {
    var $element = template.$(event.target);
    try {
      localStorage.removeItem($element.attr("draft_id"));
    } catch(e) {}
  }
});

Template.afContenteditable2.rendered = function() {
  // FIXME не работает при прямой перезагрузке страницы из строки браузера
  var dataForForm = AutoForm.getCurrentDataForForm();
  var draft_id = "draft4" + dataForForm.id + "_" + dataForForm.doc._id + "_" + this.data.atts.name;
  var $element = this.$("[contenteditable]");
  $element.attr("draft_id", draft_id);
  var draft;
  try {
    draft = localStorage.getItem(draft_id);
  } catch(e) {}
  if (draft) {
    $element.focus();
    $element.html(draft);
  } else
  if ($element.tooltip) {
    $element.tooltip();
  }
};

var defaults = {
  title: ''
};

AutoForm.Contenteditable2 = {};
AutoForm.Contenteditable2.setDefaults = function (options) {
  if (_.has(options, "title")) {
    defaults.title = options.title;
  }
}
