(function($) {
	
	$.fn.SAC = function(settings)
	{
		$this = $(this);
		$input = $this;
		
		settings = jQuery.extend({
			url: '',
			method: 'POST',
			class_name: 'sac',
			output_class_name: 'sac_output',
			min_char: 1,
			max_results: 10,
			wait: 500, // ms
			columns: [{name: '', prefix: '', suffix: '', ifnull: '?'}],
			column_pk: 'id'
		}, settings);
		
		// init
		$box = null;
		is_active = false;
		
		// request
		waiting = false;
		timeout = null;
		search = null;
		previous_search = '';
		previous_html = '';
		previous_status = 'Start typing to search';
		
		// query
		total_results = 0;
		selected = -1;
		$selected_item = null;
		
		// output
		output_div = false;
		output = {};
		
		focus_event = function(e)
		{
			if ( ! is_active)
			{
				is_active = true;
				
				options = '';
				for (i = 0; i < settings.columns.length; ++i)
				{
					options += '<option value="'+settings.columns[i].name+'">'+settings.columns[i].title+'</option>';
				}
							
				$this.after(
					 '<div class="'+settings.class_name+'" style="width:'+($this.outerWidth()-2)+'px">'
					+	'<div class="close"></div>'
					+	'<div class="results">'+previous_html+'</div>'
					+	'<div class="status">'+previous_status+'</div>'
					+	'<div class="add">'
					+		'<select style="width:'+($this.outerWidth()-65)+'px">'
					+		options
					+		'</select>'
					+   	'<input type="button" name="add" value="Add" />'
					+	'</div>'
					+'</div>');
				
				$box = $this.next('div.'+settings.class_name);
				
				$('div.'+settings.class_name+" div.close").bind('click', close);
				$('div.'+settings.class_name+" input[name=add]").bind('click', add_event);
				$('div.'+settings.class_name+" div.results li").bind('mouseover', mouseover_event);
			}
		}
		
		close = function()
		{
			is_active = false;
			selected = -1;
			$selected_item = null;
			$box.remove();
		}
		
		send = function()
		{
			waiting = false;
			previous_search = search;
			
			status = "Searching ...";
			status += '<div class="loading"></div>';
			
			clear_results();
			change_status(status);
			
			$.ajax({
				url: settings.url,
				type: settings.method,
				dataType: 'json',
				data: ({ s: search }),
				success: request_success,
				error: request_error // 404, etc.
			});			
		}
		
		change_status = function(html)
		{
			$box.children("div.status").html(status);
		}
		
		clear_results = function()
		{
			change_results('');
		}
		
		change_results = function(html)
		{
			$box.children("div.results").html(html);
		}
		
		change_output = function(html)
		{
			$input.prev('div.'+settings.output_class_name).html(html);
		}
		
		request_success = function(data, textStatus)
		{
			if (data.responseStatus == '200')
			{
				total_results = data.responseData.length;
				status = (total_results >= settings.max_results) ? 'Over ' : '';
				status += total_results + ' result(s)';
				results = parse_results(data.responseData);
				previous_html = results;
				previous_status = status;
				
				change_status(status);
				change_results(results);
				$('div.'+settings.class_name+" div.results li").bind('mouseover', mouseover_event);
			}
			else
			{
				change_status('An error occured (errno 2)');
			}			
		}
		
		request_error = function(XMLHttpRequest, textStatus, errorThrown)
		{
			change_status("An error occured (errno 1)");
		}
		
		prepend_output_div = function()
		{
			if ( ! output_div)
			{
				output_div = true;
				$input.before('<div class="'+settings.output_class_name+'"></div>');
			}
		}
		
		select = function()
		{
			if ( ! $selected_item)
				return;
			
			$input.val($selected_item.children('span').eq(0).text());
			
			html = '<div>'
					+ '<span>'+$selected_item.html()+'</span>'
					+ '<div class="delete" onclick="$(this).parent().remove()"></div>'
					+'<input type="hidden" name="'
					+ settings.column_pk
					+ '" value="'
					+ $selected_item.attr('dbid')
					+ '" />'
					+ '</div>';
					
			close();
			$input.blur();
			prepend_output_div();
			
			change_output(html);
		}
		
		mouseover_event = function(e)
		{
			if (selected != -1)
			{
				$selected_item.removeClass('selected');
			}
			$selected_item = $(this);
			selected = $(this).attr('num');
			$selected_item.addClass('selected');
			$selected_item.bind('click', function() { select(); });
		}
		
		add_event = function(e)
		{
			value = $input.val();
			
			if (value.length == 0)
				return;
			
			column = $('div.'+settings.class_name+' select').val();
			title = $('div.'+settings.class_name+' select option:selected').text()
			output[column] = { value: value, title: title};
			html = '';
			
			for(key in output)
			{
				html += '<div>'
						+	'<span>'+output[key].title+': <strong>'+output[key].value+'</strong></span>'
						+	'<div class="delete" onclick="$(this).parent().remove()"></div>'
						+	'<input type="hidden" name="'
						+	key
						+	'" value="'
						+	output[key].value
						+	'" />'
						+ '</div>';
			}
			
			close();
			$input.blur();
			prepend_output_div();
			change_output(html);
		}
		
		keyup_event = function(e)
		{
			search = $(this).val();
			switch(e.keyCode)
			{
				case 13: // ENTER
					if (search.length >= settings.min_char && previous_search != search)
					{
						window.clearTimeout(timeout);
						send();
					}
					else
					{
						select();
					}
				break;
				case 38: // ARROW_UP
					select_previous();
				break;
				case 40: // ARROW_DOWN
					select_next();
				break;
				default:
					if (waiting)
					{
						window.clearTimeout(timeout);
						if (search.length >= settings.min_char && previous_search != search)
						{
							timeout = window.setTimeout('send();', settings.wait);
						}
					}
					else
					{
						if (search.length >= settings.min_char && previous_search != search)
						{
							waiting = true;
							timeout = window.setTimeout('send();', settings.wait);
						}
					}
			}
		}
		
		parse_results = function (data)
		{
			html = '<ul>';
			i = 0;
			
			$.each(data, function()
			{
				html += '<li dbid="'+this[settings.column_pk]+'" num="'+i+'">';
				
				for (j = 0; j < settings.columns.length; ++j)
				{
					html += '<span title="'+settings.columns[j].title+'">';
					html += settings.columns[j].prefix;
					if (this[settings.columns[j].name] == null)
					{
						html += settings.columns[j].ifnull;
					}
					else
					{
						html += this[settings.columns[j].name];
					}
					html += settings.columns[j].suffix;
					html += '</span>';
				}
				
				html += '</li>';
				++i;
			});
			
			html += '</ul>'
			
			return html;
		}
		
		select_next = function ()
		{
			if (total_results > 0)
			{
				if (selected == -1 || selected == total_results - 1)
				{
					if (selected != -1)
					{
						$selected_item.removeClass('selected');
					}
					selected = 0;
					$selected_item = $('div.'+settings.class_name+" div.results li").eq(selected);
					$selected_item.addClass('selected');
				}
				else
				{					
					$selected_item.removeClass('selected');
					++selected;
					$selected_item = $('div.'+settings.class_name+" div.results li").eq(selected);
					$selected_item.addClass('selected');
				}
			}
		}
		
		select_previous = function ()
		{
			if (total_results > 0)
			{
				if (selected <= 0)
				{
					if (selected != -1)
					{
						$selected_item.removeClass('selected');
					}
					selected = total_results - 1;
					$selected_item = $('div.'+settings.class_name+" div.results li").eq(selected);
					$selected_item.addClass('selected');
					
				}
				else
				{
					$selected_item.removeClass('selected');
					--selected;
					$selected_item = $('div.'+settings.class_name+" div.results li").eq(selected);
					$selected_item.addClass('selected');
				}
			}
		}
					
		this.filter("input[type=text]").bind('focus', focus_event);
		this.filter("input[type=text]").bind('keyup', keyup_event);
		
		return $this;
	}
	
})(jQuery);