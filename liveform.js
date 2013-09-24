/**
	Copyright (c) 2012 Grigory Ponomar

	This program is free software; you can redistribute it and/or
	modify it under the terms of the GNU General Public License
	as published by the Free Software Foundation; either version 2
	of the License, or (at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details (http://www.gnu.org).
*/

LiveForm = function(form, options) 
{
	var T = this;
	
	this.options = $.extend({
		inputcontainer: 'div',
		inputlabel: 'label',
		requiredClass: 'required',
		visibilityfn: function(lf, e, visible) {
			lf.setVisibility(e, visible);
		},
		requiredfn: function(lf, e, required) {
			lf.setRequired(e, required);
		},
		libs: false,
	}, options || {});
	
	function init() {
		T.funcscope.register(Expression.libs);
		T.funcscope.register('e', function(name) {
			return T.varscope.findElement(name);
		});
		if (T.options.libs) {
			T.funcscope.register(T.options.libs);
		}
		var dep = $(T.form).find('[data-visibility],[data-required],[data-formula]');
		dep.each(function() {
			addExpression('visibility', this);
			addExpression('required', this);
			addExpression('formula', this);
			T.targets.push(this);
		});
		var k, e;
		for (k in T.triggers) {
			e = T.triggers[k];
			e.input.on('change', e, function(event) {
				if (!isElementLocked(this)) {
					lockElement(this);
					$(event.data.refresh).each(function() {
						if (!isElementLocked(this)) {
							T.refresh(this);
						}
					});
					unlockElement(this);
				}
			});
		}
		T.refreshAll();
	}
	
	function lockElement(e) {
		$(e).attr('lf-locked', 'true');
	}
	
	function unlockElement(e) {
		$(e).removeAttr('lf-locked');
	}
	
	function isElementLocked(e) {
		return $(e).attr('lf-locked');
	}
	
	function addExpression(type, element) {
		var code = $(element).attr('data-' + type);
		if (code) {
			var e = new Expression(code, T.varscope, T.funcscope);
			if (e.lastError == '') {
				$.data(element, 'lf-' + type, e);
				createTriggers(e, element);
			} else if (console.log) {
				console.log(e.lastError);
			}
		}
	}
	
	function createTriggers(expr, element) {
		$(expr.expr).each(function() {
			collect(this, element);
		});
	}
	
	function collect(node, element) {
		var i;
		switch (node[0]) {
			case 'var':
				createTrigger(node[1], element);
				break;
				
			case 'func':
				for (i = 0; i < node[2].length; i++) {
					collect(node[2][i], element);
				}
				break;
				
			case 'neg': 
			case 'not':
			case '()':
				collect(node[1], element);
				break;
				
			case ':=':
				collect(node[2], element);
				break;
				
			case '+':
			case '-':
			case '*':
			case '/':
			case 'or':
			case 'and':
				for (i = 1; i < node.length; i++) {
					collect(node[i], element);
				}
				break;

			case '=':
			case '!=':
			case '>':
			case '<':
			case '>=':
			case '<=':
				collect(node[1], element);
				collect(node[2], element);
				break;
		}
	}
	
	function createTrigger(on, targ) 
	{
		var i = T.varscope.findElement(on);
		if (i) {
			if (!(on in T.triggers)) {
				T.triggers[on] = {
					input: i,
					refresh: [targ]
				};
			} else if (T.triggers[on].refresh.indexOf(targ) == -1) {
				T.triggers[on].refresh.push(targ);
			}
		}
	}
	
	this.triggers = {};
	this.targets = [];
	this.form = form;
	this.varscope = new FormElementScope(form);
	this.funcscope = new FuncScope();
	
	init();
}

LiveForm.prototype = 
{
	refresh: function(element)
	{
		var e;
		if (e = $.data(element, 'lf-visibility')) {
			this.options.visibilityfn(this, element, e.evaluate());
		}
		if (e = $.data(element, 'lf-required')) {
			this.options.requiredfn(this, element, e.evaluate());
		}
		if (e = $.data(element, 'lf-formula')) {
			this.setValue(element, e.evaluate());
		}
	},
	refreshAll: function()
	{
		var i;
		for (i = 0; i < this.targets.length; i++) {
			this.refresh(this.targets[i]);
		}
	},
	setRequired: function(element, required) 
	{
		var l = $(element).closest(this.options.inputcontainer).find(this.options.inputlabel);
		if (required) {
			if (l.children('.' + this.options.requiredClass).length == 0) {
				l.append('<span class="' + this.options.requiredClass + '"> *</span>');
			}
		} else {
			l.children('.' + this.options.requiredClass).remove();
		}
	},
	isRequired: function(element) {
		if (e = $.data(element, 'lf-required')) {
			return e.evaluate();
		}
		return false;
	},
	setVisibility: function(element, visible)
	{
		if ($(element).is('fieldset,[role=fieldset]')) {
			if (visible) {
				$(element).show();
			} else {
				$(element).hide();
			}
		} else {
			if (visible) {
				$(element).closest(this.options.inputcontainer).show();
			} else {
				$(element).closest(this.options.inputcontainer).hide();
			}
		}
	},
	getValue: function(element)
	{
		return this.varscope.eget($(element));
	},
	setValue: function(element, value)
	{
		this.varscope.eset($(element), value);
		$(element).trigger('change');
	}
};

FormElementScope = function(form) {
	this.form = form;
	this._e = {};
	this._t = {};
}

FormElementScope.prototype = 
{
	reset: function(vars)
	{
		this._t = {};
	},
	get: function(varn)
	{
		var e = this.findElement(varn);
		return e ? this.eget(e) : this.tget(varn);
	},
	set: function(varn, val)
	{
		var e = this.findElement(varn);
		return e ? this.eset(e, val) : this.tset(varn, val);
	},
	tget: function (varn) {
		if (varn in this._t) {
			return this._t[varn];
		}
		return (this._t[varn] = 0);
	},
	tset: function (varn, val) {
		return (this._t[varn] = val);
	},
	eget: function(e)
	{
		var t;
		if (e.is('input')) {
			t = e.attr('type') || '';
			switch (t.toLowerCase()) {
				case 'checkbox': 
					return e.get(0).checked ? 1 : 0;
				case 'radio': 
					return e.filter(':checked').val();
				default: 
					return $.trim(e.val());
			}
		} else if (e.is('select')) {
			return e.val();
		}else {
			t = e.attr('role') || '';
			switch (t.toLowerCase()) {
				case 'radiogroup': 
					return e.find('input[type=radio]:checked').val();
				case 'checkboxgroup': 
					var r = [];
					e.find('input[type=checkbox]:checked').each(function() {
						r.push(this.value);
					});
					return r;
				default:
					return null;
			}
		}
	},
	eset: function(e, val)
	{
		var t, v;
		if (e.is('input')) {
			t = e.attr('type') || '';
			switch (t.toLowerCase()) {
				case 'checkbox': 
					e.get(0).checked = val ? true : false; 
					break;
				case 'radio': 
					e.each(function() {
						this.checked = this.value == val;
					});
					break;
				default:
					e.val(typeof val === 'number' && (isNaN(val) || val == Infinity) ? 0 : val);
					break;
			}
		} else if (e.is('select')) {
			e.val(val);
		} else {
			t = e.attr('role') || '';
			switch (t.toLowerCase()) {
				case 'radiogroup': 
					e.find('input[type=radio]').each(function() {
						this.checked = this.value == val;
					});
					break;
				case 'checkboxgroup':
					v = typeof val == 'object' ? val : [val];
					e.find('input[type=checkbox]:checked').each(function() {
						this.checked = v.indexOf(this.value) != -1;
					});
					break;
			}
		}
		return val;
	},
	getAll: function()
	{
		var k, e = {};
		for (k in this._e) {
			e[k] = this.get(k);
		}
		return e;
	},
	findElement: function(name)
	{
		if (name in this._e) {
			return this._e[name];
		}
		var r = $(this.form.elements)
			.filter('#' + name + ',[name="' + name + '"],[name$="[' + name + ']"]')
			.filter(':not([type=hidden])');
		return this._e[name] = r.length ? r : false;
	}
};

(function($){
	
	function elem(lf, name) {
		if (typeof name === 'string') {
			return lf.varscope.findElement(name);
		} else {
			return name;
		}
	}

	var methods = {
		init : function(options) { 
			$(this).each(function() {
				var lf = new LiveForm(this, options);
				$.data(this, 'liveform', lf);
			});
		},
		hide: function(name) {
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				lf && lf.setVisibility(elem(lf, name), false);
			});
		},
		show: function(name) {
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				lf && lf.setVisibility(elem(lf, name), true);
			});
		},
		getIsRequired: function(name) {
			var result = false;
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				if (lf) {
					result = lf.isRequired(elem(lf, name).get(0));
					return false;
				}
			});
			return result;
		},
		required: function(name) {
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				lf && lf.setRequired(elem(lf, name), true);
			});
		},
		nonRequired: function(name) {
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				lf && lf.setRequired(elem(lf, name), false);
			});
		},
		setValue: function(name, value) {
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				lf && lf.setValue(elem(lf, name), value);
			});
		},
		getValue: function(name) {
			var result = null;
			$(this).each(function() {
				var lf = $.data(this, 'liveform');
				if (lf) {
					result = lf.getValue(elem(lf, name));
					return false;
				}
			});
			return result;
		},
	};

	$.fn.liveform = function(method) {
		if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		} else if (method in methods) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		}
	};

})(jQuery);
