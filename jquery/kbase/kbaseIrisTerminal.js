/*


*/

(function( $, undefined ) {


    $.kbWidget("kbaseIrisTerminal", 'kbaseWidget', {
        version: "1.0.0",
        options: {
            invocationURL : 'http://localhost:5000',
//            invocationURL : 'http://bio-data-1.mcs.anl.gov/services/invocation',
            maxOutput : 100,
            scrollSpeed : 750,
            terminalHeight : '500px',
            promptIfUnauthenticated : 1,
        },

        init: function(options) {

            this._super(options);

            //for lack of a better place to put it, the plugin to set cursor position
            $.fn.setCursorPosition = function(position){
                if(this.length == 0) return this;
                return $(this).setSelection(position, position);
            }

            $.fn.setSelection = function(selectionStart, selectionEnd) {
                if(this.length == 0) return this;
                input = this[0];
                if (input.createTextRange) {
                    var range = input.createTextRange();
                    range.collapse(true);
                    range.moveEnd('character', selectionEnd);
                    range.moveStart('character', selectionStart);
                    range.select();
                } else if (input.setSelectionRange) {
                    input.focus();
                    input.setSelectionRange(selectionStart, selectionEnd);
                }

                return this;
            }

            $.fn.focusEnd = function(){
                this.setCursorPosition(this.val().length);
                        return this;
            }

            $.fn.getCursorPosition = function() {
                if(this.length == 0) return this;
                input = this[0];

                return input.selectionEnd;
            }

            //end embedded plugin

            if (this.options.client) {
                this.client = this.options.client;
            }
            else {
                this.client = new InvocationService(this.options.invocationURL, undefined,
                    jQuery.proxy(function() {
                        var cookie_obj = this.$loginbox.kbaseLogin('get_kbase_cookie');
                        if (cookie_obj) {
                            var token = cookie_obj['token'];
                            this.dbg("returning token from auth_cb " + token);
                            return token;
                        }
                        else {
                            this.dbg("returning undef from auth_cb ");
                            return undefined;
                        }
                    }, this));
            }

            this.$loginbox =
                $("<div></div>").kbaseLogin(
                    {
                        style : 'text',
                        login_callback :
                            jQuery.proxy(
                                function(args) {
                                    if (args.success) {
                                        this.out_line();
                                        this.client.start_session_async(
                                            args.user_id,
                                            jQuery.proxy(
                                                function (newsid) {
                                                    this.set_session(args.user_id);
                                                    this.loadCommandHistory();
                                                    this.out("Set session to " + args.user_id);
                                                    this.scroll();
                                                },
                                                this
                                            ),
                                            jQuery.proxy(
                                                function (err) {
                                                    this.out("<i>Error on session_start:<br>" +
                                                    err.message.replace("\n", "<br>\n") + "</i>");
                                                },
                                                this
                                            )
                                        );

                                        this.kbase_sessionid = args.kbase_sessionid;
                                        this.input_box.focus();

                                        if (this.data('fileBrowser')) {
                                            this.data('fileBrowser').refreshDirectory(this.cwd);
                                        }
                                    }
                                },
                                this
                            ),
                        logout_callback :
                            jQuery.proxy(
                                function() {
                                    this.sessionId = undefined;
                                    this.dbg("LOGOUT CALLBACK");
                                    if (this.data('fileBrowser')) {
                                        this.data('fileBrowser').refreshDirectory(this.cwd);
                                    }
                                },
                                this
                            )
                    }
                );

            this.tutorial_position = 1;
            this.commandHistory = [];
            this.commandHistoryPosition = 0;

            this.path = '.';
            this.cwd = "/";

            this.appendUI( $( this.$elem ) );

            var cookie;

            if (cookie = this.$loginbox.get_kbase_cookie()) {
                var $commandDiv = $("<div></div>").css('white-space', 'pre');
                this.terminal.append($commandDiv);
                this.out_line();
                if (cookie.user_id) {
                    this.out_to_div($commandDiv, 'Already logged in as ' + cookie.name + "\n");
                    this.set_session(cookie.user_id);
                    this.loadCommandHistory();
                    this.out_to_div($commandDiv, "Set session to " + cookie.user_id);
                }
                else if (this.options.promptIfUnauthenticated) {
                    this.$loginbox.kbaseLogin('openDialog');
                }
            }
            else if (this.options.promptIfUnauthenticated) {
                this.$loginbox.kbaseLogin('openDialog');
            }

            if (this.options.fileBrowser) {
                this.data('fileBrowser', this.options.fileBrowser);
            }
            else {
                this.data(
                    'fileBrowser',
                    $('<div></div>').kbaseIrisFileBrowser (
                        {
                            client : this.client,
                            $loginbox : this.$loginbox,
                            externalControls : false,
                        }
                    )
                )
            };

            return this;

        },

        loginbox : function () {
            return this.$loginbox;
        },

        getClient : function() {
            return this.client;
        },

        authToken : function() {
            var cookieObj = this.$loginbox.kbaseLogin('get_kbase_cookie');
            if (cookieObj != undefined) {
                return cookieObj['token'];
            }
            else {
                return undefined;
            }
        },

        appendInput : function(text, spacer) {
            if (this.input_box) {
                var space = spacer == undefined ? ' ' : '';

                if (this.input_box.val().length == 0) {
                    space = '';
                };

                this.input_box.val(this.input_box.val() + space + text);
                this.input_box.focusEnd();
            }
        },

        appendUI : function($elem) {

            var $block = $('<div></div>')
                .append(
                    $('<div></div>')
                        .attr('id', 'terminal')
                        .css('height' , this.options.terminalHeight)
                        .css('overflow', 'auto')
                        .css('padding' , '5px')
                        .css('font-family' , 'monospace')
                )
                .append(
                    $('<textarea></textarea>')
                        .attr('id', 'input_box')
                        .attr('style', 'width : 99%;')
                        .attr('height', '3')
                    )
                .append(
                    $('<div></div>')
                        .attr('id', 'file-uploader')
                    )
                .append(
                    $('<div></div>')
                        .attr('id', 'panel')
                        .css('display', 'none')
                    );
            ;

            this._rewireIds($block, this);

            $elem.append($block);

            this.terminal = this.data('terminal');
            this.input_box = this.data('input_box');

            this.out('Welcome to the interactive KBase.');
            this.out_line();

            this.input_box.bind(
                'keypress',
                jQuery.proxy(function(event) { this.keypress(event); }, this)
            );
            this.input_box.bind(
                'keydown',
                jQuery.proxy(function(event) { this.keydown(event) }, this)
            );
            this.input_box.bind(
                "onchange",
                jQuery.proxy(function(event) { this.dbg("change"); }, this)
            );


            this.data('input_box').focus();

            $(window).bind(
                "resize",
                jQuery.proxy(
                    function(event) { this.resize_contents(this.terminal) },
                    this
                )
            );

            this.resize_contents(this.terminal);


        },

        saveCommandHistory : function() {
            this.client.put_file_async(
                this.sessionId,
                "history",
                JSON.stringify(this.commandHistory),
                "/",
                function() {},
                function() {}
            );
        },

        loadCommandHistory : function() {
            this.client.get_file_async(
                this.sessionId,
                "history", "/",
                jQuery.proxy(
                    function (txt) {
                        this.commandHistory = JSON.parse(txt);
                        this.commandHistoryPosition = this.commandHistory.length;
                    },
                    this
                ),
                jQuery.proxy(function (e) {
                    this.dbg("error on history load : " + e);
		    }, this)
            );
        },

        set_session: function(session) {
            this.sessionId = session;
        },

        resize_contents: function($container) {
            //	var newx = window.getSize().y - document.id(footer).getSize().y - 35;
            //	container.style.height = newx;
        },

        keypress: function(event) {

            if (event.which == 13) {
                event.preventDefault();
                var cmd = this.input_box.val();

                // commented out regexes to auto-quote kb| ids
                /*
                cmd = cmd.replace(/ (kb\|[^ ]+)( |$)/g, ' "$1" ');

                cmd = cmd.replace(/([^"])(kb\|[^ "]+)"/g, '$1"$2"');
                cmd = cmd.replace(/"(kb\|[^ "]+)/g, '"$1"');
                cmd = cmd.replace(/"+(kb\|[^ "]+)"+/g, '"$1"');

                cmd = cmd.replace(/([^'])(kb\|[^ ']+)'/g, "$1'$2'");
                cmd = cmd.replace(/'(kb\|[^ ']+)/g, "'$1'");
                cmd = cmd.replace(/'+(kb\|[^ ']+)'+/g, "'$1'");

                cmd = cmd.replace(/"'(kb\|[^ ']+)'"/g, "'$1'");
                */

                cmd = cmd.replace(/^ +/, '');
                cmd = cmd.replace(/ +$/, '');

                this.dbg("Run (" + cmd + ')');
                this.out_cmd(cmd);
                this.run(cmd);
                this.scroll();
                this.input_box.val('');
            }
        },

        keydown: function(event) {

            if (event.which == 38) {
                event.preventDefault();
                if (this.commandHistoryPosition > 0) {
                    this.commandHistoryPosition--;
                }
                this.input_box.val(this.commandHistory[this.commandHistoryPosition]);
            }
            else if (event.which == 40) {
                event.preventDefault();
                if (this.commandHistoryPosition < this.commandHistory.length) {
                    this.commandHistoryPosition++;
                }
                this.input_box.val(this.commandHistory[this.commandHistoryPosition]);
            }
            else if (event.which == 39) {
                if (this.options.commandsElement) {

                    var input_box_length = this.input_box.val().length;
                    var cursorPosition = this.input_box.getCursorPosition();

                    if (cursorPosition != undefined && cursorPosition < input_box_length) {
                        return;
                    }

                    event.preventDefault();

                    var toComplete = this.input_box.val().match(/([^\s]+)\s*$/);
                    if (toComplete.length) {
                        toComplete = toComplete[1];

                        var completions = this.options.commandsElement.kbaseIrisCommands('completeCommand', toComplete);
                        if (completions.length == 1) {
                            var completion = completions[0].replace(new RegExp('^' + toComplete), '');
                            this.appendInput(completion + ' ', 0);
                        }
                        else if (completions.length) {

                            var prefix = this.options.commandsElement.kbaseIrisCommands('comonCommandPrefix', completions);

                            if (prefix != undefined && prefix.length) {
                                this.input_box.val(
                                    this.input_box.val().replace(new RegExp(toComplete + '\s*$'), prefix)
                                );
                            }

                            var $commandDiv = $('<div></div>');
                            this.terminal.append($commandDiv);

                            var $tbl = $('<table></table>')
                                .attr('border', 1)
                                .css('margin-top', '10px')
                                .append(
                                    $('<tr></tr>')
                                        .append(
                                            $('<th></th>')
                                                .text('Suggested commands')
                                        )
                                    );
                            jQuery.each(
                                completions,
                                jQuery.proxy(
                                    function (idx, val) {
                                        $tbl.append(
                                            $('<tr></tr>')
                                                .append(
                                                    $('<td></td>')
                                                        .append(
                                                            $('<a></a>')
                                                                .attr('href', '#')
                                                                .text(val)
                                                                .bind('click',
                                                                    jQuery.proxy(
                                                                        function (evt) {
                                                                            evt.preventDefault();
                                                                            this.input_box.val(
                                                                                this.input_box.val().replace(new RegExp(toComplete + '\s*$'), '')
                                                                            );
                                                                            this.appendInput(val + ' ');
                                                                        },
                                                                        this
                                                                    )
                                                                )
                                                        )
                                                    )
                                            );
                                    },
                                    this
                                )
                            );
                            $commandDiv.append($tbl);
                            this.scroll();

                        }
                    }

                }
            }

        },

        out_cmd: function(text) {


            var $wrapperDiv = $('<div></div>')
                .css('white-space', 'pre')
                .css('position', 'relative')
                .append(
                    $('<div></div>')
                        .addClass('btn-group')
                        .css('display', 'none')
                        .css('position', 'absolute')
                        .css('top', '0px')
                        .css('right', '0px')
                        .css('text-align', 'right')
                        .append(
                            $('<a></a>')
                                .addClass('btn btn-mini')
                                .append(
                                    $('<i></i>')
                                        .addClass('icon-download-alt')
                                )
                                .attr('title', 'Open results in new window')
                                .bind('click',
                                    function (e) {
                                        var win = window.open();
                                        win.document.open();
                                        var output =
                                            $('<div></div>')
                                                .append(
                                                    $('<div></div>')
                                                        .css('white-space', 'pre')
                                                        .css('font-family' , 'monospace')
                                                        .append(
                                                            $(this).parent().parent().next().clone()
                                                        )
                                                )
                                        ;
                                        $.each(
                                            output.find('a'),
                                            function (idx, val) {
                                                $(val).replaceWith($(val).html());
                                            }
                                        );

                                        win.document.write(output.html());
                                        win.document.close();
                                    }
                                )
                        )
                        .append(
                            $('<a></a>')
                                .addClass('btn btn-mini')
                                .append(
                                    $('<i></i>')
                                        .addClass('icon-remove')
                                )
                                .attr('title', 'delete command from window')
                                .bind('click',
                                    function (e) {
                                        $(this).parent().parent().next().remove();
                                        $(this).parent().parent().next().remove();
                                        $(this).parent().parent().remove();
                                    }
                                )
                        )
                )
                .append(
                    $('<span></span>')
                        .addClass('command')
                        .text(">" + this.cwd + " " + text)
                )
                .mouseover(
                    function(e) {
                        $(this).children().first().show();
                    }
                )
                .mouseout(
                    function(e) {
                        $(this).children().first().hide();
                    }
                )
            ;

            this.terminal.append($wrapperDiv);
        },

        // Outputs a line of text
        out: function(text, scroll, html) {
            this.out_to_div(this.terminal, text, scroll, html);
        },

        // Outputs a line of text
        out_to_div: function($div, text, scroll, html) {
            if (!html && typeof text == 'string') {
                text = text.replace(/</g, '&lt;');
                text = text.replace(/>/g, '&gt;');
            }

            $div.append(text);
            if (scroll) {
                this.scroll(0);
            }
        },

        // Outputs a line of text
        out_line: function(text) {
            var $hr = $('<hr/>');
            this.terminal.append($hr);
            this.scroll(0);
        },

        scroll: function(speed) {
            if (speed == undefined) {
                speed = this.options.scrollSpeed;
            }

            this.terminal.animate({scrollTop: this.terminal.prop('scrollHeight') - this.terminal.height()}, speed);
        },

        open_file : function(file) {
            if (this.data('fileBrowser')) {
                this.data('fileBrowser').openFile(file);
            }
            else {
                this.dbg("Cannot open file - No file browser!");
            }
        },

        // Executes a command
        run: function(command) {

            if (command == 'help') {
                this.out('There is an introductory Iris tutorial available <a target="_blank" href="http://kbase.us/developer-zone/tutorials/iris/introduction-to-the-kbase-iris-interface/">on the KBase tutorials website</a>.', 0, 1);
                return;
            }


            var $commandDiv = $('<div></div>').css('white-space', 'pre');
//            $wrapperDiv.append($commandDiv);

            this.terminal.append($commandDiv);

            this.out_line();

            var m;

            if (m = command.match(/^log[io]n\s*(.*)/)) {
                var args = m[1].split(/\s+/);
                this.dbg(args.length);
                if (args.length != 1) {
                    this.out_to_div($commandDiv, "Invalid login syntax.");
                    return;
                }
                sid = args[0];

                //old login code. copy and pasted into iris.html.
                this.client.start_session_async(
                    sid,
                    jQuery.proxy(
                        function (newsid) {
                            this.set_session(sid);
                            this.loadCommandHistory();
                            this.out_to_div($commandDiv, "Set session to " + sid);
                        },
                        this
                    ),
                    jQuery.proxy(
                        function (err) {
                            this.out_to_div($commandDiv, "<i>Error on session_start:<br>" +
                                err.message.replace("\n", "<br>\n") + "</i>");
                        },
                        this
                    )
                );
                this.scroll();
                return;
            }

            if (m = command.match(/^authenticate\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 1) {
                    this.out_to_div($commandDiv, "Invalid login syntax.");
                    return;
                }
                sid = args[0];

                this.$loginbox.kbaseLogin('data', 'passed_user_id', sid);
                this.$loginbox.data('passed_user_id', sid);

                this.$loginbox.kbaseLogin('openDialog');

                return;
            }

            if (m = command.match(/^unauthenticate/)) {

                this.$loginbox.kbaseLogin('logout');
                this.scroll();
                return;
            }

            if (m = command.match(/^logout/)) {

                this.sessionId = undefined;
                this.scroll();
                return;
            }


            if (! this.sessionId) {
                this.out_to_div($commandDiv, "You are not logged in.");
                this.scroll();
                return;
            }

            this.commandHistory.push(command);
            this.saveCommandHistory();
            this.commandHistoryPosition = this.commandHistory.length;

            if (command == 'clear') {
                this.terminal.empty();
                return;
            }

            if (command == 'history') {
                var $tbl = $('<table></table>');
                jQuery.each(
                    this.commandHistory,
                    jQuery.proxy(
                        function (idx, val) {
                            $tbl.append(
                                $('<tr></tr>')
                                    .append(
                                        $('<td></td>')
                                            .text(idx)
                                    )
                                    .append(
                                        $('<td></td>')
                                            .css('padding-left', '10px')
                                            .append(
                                                $('<a></a>')
                                                    .attr('href', '#')
                                                    .text(val)
                                                    .bind('click',
                                                        jQuery.proxy(
                                                            function (evt) {
                                                                evt.preventDefault();
                                                                this.appendInput(val + ' ');
                                                            },
                                                            this
                                                        )
                                                    )
                                            )
                                    )
                                );
                        },
                        this
                    )
                );

                this.out_to_div($commandDiv, $tbl);
                return;
            }
            else if (m = command.match(/^!(\d+)/)) {
                command = this.commandHistory.item(m[1]);
            }


            if (m = command.match(/^cd\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 1) {
                    this.out_to_div($commandDiv, "Invalid cd syntax.");
                    return;
                }
                dir = args[0];

                this.client.change_directory_async(
                    this.sessionId,
                    this.cwd,
                    dir,
                        jQuery.proxy(
                            function (path) {
                                this.cwd = path;
                            },
                            this
                        ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("/\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                        },
                        this
                    )
                );
                return;
            }

            if (m = command.match(/^cp\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 2) {
                    this.out_to_div($commandDiv, "Invalid cp syntax.");
                    return;
                }
                from = args[0];
                to   = args[1];
                this.client.copy_async(
                    this.sessionId,
                    this.cwd,
                    from,
                    to,
                    $.proxy(
                        function () {
                            if (this.data('fileBrowser')) {
                                this.data('fileBrowser').refreshDirectory(this.cwd);
                            }
                        },this
                    ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                        },
                        this
                    )
                );
                return;
            }
            if (m = command.match(/^mv\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 2) {
                    this.out_to_div($commandDiv, "Invalid mv syntax.");
                    return;
                }

                from = args[0];
                to   = args[1];
                this.client.rename_file_async(
                    this.sessionId,
                    this.cwd,
                    from,
                    to,
                    $.proxy(
                        function () {
                            if (this.data('fileBrowser')) {
                                this.data('fileBrowser').refreshDirectory(this.cwd);
                            }
                        },this
                    ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                        },
                        this
                    ));
                return;
            }

            if (m = command.match(/^mkdir\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 1){
                    this.out_to_div($commandDiv, "Invalid mkdir syntax.");
                    return;
                }
                dir = args[0];
                this.client.make_directory_async(
                    this.sessionId,
                    this.cwd,
                    dir,
                    $.proxy(
                        function () {
                            if (this.data('fileBrowser')) {
                                this.data('fileBrowser').refreshDirectory(this.cwd);
                            }
                        },this
                    ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                        },
                        this
                    )
                );
                return;
            }

            if (m = command.match(/^rmdir\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 1) {
                    this.out_to_div($commandDiv, "Invalid rmdir syntax.");
                    return;
                }
                dir = args[0];
                this.client.remove_directory_async(
                    this.sessionId,
                    this.cwd,
                    dir,
                    $.proxy(
                        function () {
                            if (this.data('fileBrowser')) {
                                this.data('fileBrowser').refreshDirectory(this.cwd);
                            }
                        },this
                    ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                        },
                        this
                    )
                );
                return;
            }

            if (m = command.match(/^rm\s*(.*)/)) {
                var args = m[1].split(/\s+/)
                if (args.length != 1) {
                    this.out_to_div($commandDiv, "Invalid rm syntax.");
                    return;
                }
                file = args[0];
                this.client.remove_files_async(
                    this.sessionId,
                    this.cwd,
                    file,
                    $.proxy(
                        function () {
                            if (this.data('fileBrowser')) {
                                this.data('fileBrowser').refreshDirectory(this.cwd);
                            }
                        },this
                    ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                        },
                        this
                    )
                );
                return;
            }

            if (command == "next") {
                if (this.tutorial_next >= 0) {
                    this.tutorial_position = this.tutorial_next;
                }
                command = "show_tutorial";
            }

            if (command == "back") {
                if (this.tutorial_prev >= 0) {
                    this.tutorial_position = this.tutorial_prev;
                }
                command = "show_tutorial";
            }

            if (command == "tutorial") {
                this.tutorial_position = 1;
                command = "show_tutorial";
            }

            if (command == 'show_tutorial') {
                this.client.get_tutorial_text_async(
                    this.tutorial_position,
                    jQuery.proxy(
                        function (what) {
                            var text = what[0];
                            var prev = what[1];
                            var next = what[2];

                            this.tutorial_next = next;
                            this.tutorial_prev = prev;
                            if (prev >= 0) {
                                text += "<br>Type <i>back</i> to move to the previous step in the tutorial.";
                            }
                            if (next >= 0) {
                                text += "<br>Type <i>next</i> to move to the next step in the tutorial.";
                            }
                            this.out_to_div($commandDiv, text,0,1);
                            this.scroll();
                        },
                        this
                    ),
                    jQuery.proxy(
                        function (err) {
                            var m = err.message.replace("\n", "<br>\n");
                            this.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                            this.scroll();
                        },
                        this
                    )
                );
                return;
            }

            if (command == 'commands') {
                this.client.valid_commands_async(
                    jQuery.proxy(
                        function (cmds) {
                            var $tbl = $('<table></table>');
                            jQuery.each(
                                cmds,
                                function (idx, group) {
                                    $tbl.append(
                                        $('<tr></tr>')
                                            .append(
                                                $('<th></th>')
                                                    .attr('colspan', 2)
                                                    .html(group.title)
                                                )
                                        );

                                    for (var ri = 0; ri < group.items.length; ri += 2) {
                                        $tbl.append(
                                            $('<tr></tr>')
                                                .append(
                                                    $('<td></td>')
                                                        .html(group.items[ri].cmd)
                                                    )
                                                .append(
                                                    $('<td></td>')
                                                        .html(
                                                            group.items[ri + 1] != undefined
                                                                ? group.items[ri + 1].cmd
                                                                : ''
                                                        )
                                                    )
                                            );
                                    }
                                }
                            );
                            $commandDiv.append($tbl);
                            this.scroll();

                        },
                       this
                    )
                );
                return;
            }

            if (d = command.match(/^ls\s*(.*)/)) {
                var args = d[1].split(/\s+/)
                var obj = this;
                if (args.length == 0) {
                    d = ".";
                }
                else {
                    if (args.length != 1) {
                        this.out_to_div($commandDiv, "Invalid ls syntax.");
                        return;
                    }
                    else {
                        d = args[0];
                    }
                }

                this.client.list_files_async(
                    this.sessionId,
                    this.cwd,
                    d,
                    jQuery.proxy(
                        function (filelist) {
                            var dirs = filelist[0];
                            var files = filelist[1];

                            var $tbl = $('<table></table>')
                                //.attr('border', 1);

                            jQuery.each(
                                dirs,
                                function (idx, val) {
                                    $tbl.append(
                                        $('<tr></tr>')
                                            .append(
                                                $('<td></td>')
                                                    .text('0')
                                                )
                                            .append(
                                                $('<td></td>')
                                                    .html(val['mod_date'])
                                                )
                                            .append(
                                                $('<td></td>')
                                                    .html(val['name'])
                                                )
                                        );
                                }
                            );

                            jQuery.each(
                                files,
                                jQuery.proxy(
                                    function (idx, val) {
                                        var url = this.options.invocationURL + "/download/" + val['full_path'] + "?session_id=" + this.sessionId;
                                        $tbl.append(
                                            $('<tr></tr>')
                                                .append(
                                                    $('<td></td>')
                                                        .text(val['size'])
                                                    )
                                                .append(
                                                    $('<td></td>')
                                                        .html(val['mod_date'])
                                                    )
                                                .append(
                                                    $('<td></td>')
                                                        .append(
                                                            $('<a></a>')
                                                                .text(val['name'])
                                                                //uncomment these two lines to click and open in new window
                                                                //.attr('href', url)
                                                                //.attr('target', '_blank')
                                                                //comment out this block if you don't want the clicks to pop up via the api
                                                                //*
                                                                .attr('href', '#')
                                                                .bind(
                                                                    'click',
                                                                    jQuery.proxy(
                                                                        function (event) {
                                                                            event.preventDefault();
                                                                            this.open_file(val['full_path']);
                                                                        },
                                                                        this
                                                                    )
                                                                )
                                                                //*/
                                                            )
                                                    )
                                            );
                                    },
                                    this
                                )
                            );

                            $commandDiv.append($tbl);
                            this.scroll();
                         },
                         this
                     ),
                     function (err)
                     {
                         var m = err.message.replace("\n", "<br>\n");
                         obj.out_to_div($commandDiv, "<i>Error received:<br>" + err.code + "<br>" + m + "</i>");
                     }
                    );
                return;
            }

            command = command.replace(/\\\n/g, " ");
            command = command.replace(/\n/g, " ");

            var $pendingProcessElem;

            if (this.data('processList')) {
                $pendingProcessElem = this.data('processList').addProcess(command);
            }

            this.client.run_pipeline_async(
                this.sessionId,
                command,
                [],
                this.options.maxOutput,
                this.cwd,
                jQuery.proxy(
                    function (runout) {

                        if (this.data('processList')) {
                            this.data('processList').removeProcess($pendingProcessElem);
                        }

                        if (runout) {
                            var output = runout[0];
                            var error  = runout[1];

                            if (this.data('fileBrowser')) {
                                this.data('fileBrowser').refreshDirectory(this.cwd);
                            }

                            if (output.length > 0 && output[0].indexOf("\t") >= 0) {

                                var $tbl = $('<table></table>')
                                    //.attr('border', 1);

                                jQuery.each(
                                    output,
                                    jQuery.proxy(
                                        function (idx, val) {
                                            var parts = val.split(/\t/);
                                            var $row = $('<tr></tr>')
                                            jQuery.each(
                                                parts,
                                                jQuery.proxy(
                                                    function (idx, val) {
                                                        $row.append(
                                                            $('<td></td>')
                                                                .html(val)
                                                            );
                                                        if (idx > 0) {
                                                            $row.children().last().css('padding-left', '15px')
                                                        }
                                                        if (idx < parts.length - 1) {
                                                            $row.children().last().css('padding-right', '15px')
                                                        }
                                                    },
                                                    this
                                                )
                                            );
                                            $tbl.append($row);
                                        },
                                        this
                                    )
                                );
                                $commandDiv.append($tbl);
                            }
                            else {
                                jQuery.each(
                                    output,
                                    jQuery.proxy(
                                        function (idx, val) {
                                            this.out_to_div($commandDiv, val, 0);
                                        },
                                        this
                                    )
                                );

                                if (error.length) {
                                    jQuery.each(
                                        error,
                                        jQuery.proxy(
                                            function (idx, val) {
                                                this.out_to_div($commandDiv, $('<i></i>').html(val));
                                            },
                                            this
                                        )
                                    );
                                }
				else
				{
				    this.out_to_div($commandDiv, $('<i></i>').html("Command completed."));
				}
                            }
                        }
                        else {
                            this.out_to_div($commandDiv, "Error running command.");
                        }
                        this.scroll();
                    },
                    this
                )
            );
        }

    });

}( jQuery ) );


