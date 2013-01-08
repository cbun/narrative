/*


*/


(function( $, undefined ) {


    $.widget("kbaseNarrative.narrative", $.kbase.widget, {
        version: "1.0.0",
        options: {
            name : 'New Narrative',
            blockCounter : 0,
        },

        _create : function() {
            this.client = new InvocationService();

            this.user_id = window.$ld.login('session').user_id;
            this.wd = '/narratives/' + this.options.name;


            this.appendUI( $( this.element ) );

            if (this.options.output) {
                this.appendOutputUI(this.options.output);
            }

            try {
                this.client.make_directory(this.user_id, '/', 'narratives');
            }
            catch (e) {
                //already has narratives directory
                //console.log("already has narrative");console.log(e);
            }

            var previouslySaved = 0;

            try{
                var res = this.client.list_files(this.user_id, this.wd);

                if (res) {
                    previouslySaved = 1;
                }
            }
            catch(e) {
                this.client.make_directory(this.user_id, this.wd);
                this.addComment({'value' : 'Click on a command on the left to add it to the queue.\nDrag and drop to re-arrange if you forgot something!'});
            }

            if (previouslySaved) {
                //console.log('loading prior narrative');

                try {
                    var savedNarrative = this.client.get_file(this.user_id, 'narrative.data', this.wd);
                    var instructions = JSON.parse(savedNarrative);

                    this.options.blockCounter = instructions.blockCounter;
                    this.options.name = instructions.name;
                    this.user_id = instructions.owner;
                    this.wd = instructions.wd;

                    $.each(
                        instructions.elements,
                        $.proxy(
                            function(idx, val) {
                                val.noSave = true;
                                if (val.blockType == 'comment') {
                                    this.addComment(
                                        {
                                            value   : val.comment,
                                            id      : val.id,
                                        }
                                    );
                                }
                                else {

                                    var $block = this.addBlock(val);

                                    this.client.get_file_async(
                                        this.user_id,
                                        val.id,
                                        this.wd,
                                        $.proxy(
                                            function (res) {
                                                this[val.blockType]('appendOutputUI', res);
                                            },
                                            $block
                                        ),
                                        function (err) { console.log("FILE FAILURE"); console.log(err) }
                                    );

                                }
                            },
                            this
                        )
                    );

                }
                catch(e) {
                    console.log(e);
                }
            }

            $(window).bind(
                'resize',
                $.proxy(
                    function(evt) {
                        this.reposition(evt);
                    },
                    this
                )
            );

            $(this.element).data('isNarrative', 1);

            //THIS IS A TEMPORARY HACK!
            setTimeout(function() {$('#commandcontext').commandcontext('refresh')}, 500);

            return this;
        },

        save : function() {
            var output = {
                name            : this.options.name,
                wd              : this.wd,
                owner           : this.user_id,
                blockCounter    : this.options.blockCounter,
                elements        : [],
            };

            $.each(
                this.data('workspace').children(),
                function (idx, val) {
                    var blockType = $(val).data('blockType');
                    if ($(val)[blockType]) {
                    console.log("BLOCK DEF" + blockType);
                        output.elements.push($(val)[blockType]('blockDefinition'));
                    }
                }
            );

            var json = JSON.stringify(output);

            this.client.put_file(this.user_id, 'narrative.data', json, this.wd);
        },

        generateBlockID: function () {
            return this.options.name + '-' + this.options.blockCounter++;
        },

        addBlock : function(options) {

            if (options == undefined) {
                options = {};
            }

            if (options.activateCallback == undefined) {
                options.activateCallback = $.proxy( this.blockActivateCallback, this);
            }
            if (options.deactivateCallback == undefined) {
                options.deactivateCallback = $.proxy( this.blockDeactivateCallback, this);
            }

            if (options.id == undefined) {
                options.id = this.generateBlockID();
            }

            //if (options.blockType == undefined) {
            //    options.blockType = 'narrativeBlock';
            //}

            var $target = undefined;
            if (options.target) {
                $target = options.target;
                options.target = undefined;
            }

            var prompt = 0;
            if (options.prompt) {
                prompt = options.prompt;
                options.prompt = undefined;
            }

            if (options.blockOptions) {
                for (prop in options.blockOptions) {
                    options[prop] = options.blockOptions[prop];
                }
                options.blockOptions = undefined;
            }

            options.narrative = this;
console.log("OPTS");console.log(options);
            var metaFunc = MetaToolInfo(options.name);

            if (metaFunc != undefined) {
            console.log(options);
            console.log(metaFunc);
                var meta = metaFunc(options.name);
                for (key in meta) {
                    options[key] = meta[key];
                }
            }
console.log("ADDS WITH OPTIONS"); console.log(options);
            var $block = $('<div></div>')[options.blockType](options);

            if ($target) {
                $target.replaceWith($block);
            }
            else if (this.data('activeBlock')) {
                this.data('activeBlock').element.after($block);
            }
            else {
                this.data('workspace').append($block);
            }

            if (! options.noSave) {
                this.save();
            }

            $block[options.blockType]('reposition');

            //THIS IS A TEMPORARY HACK!
            $('#commandcontext').commandcontext('refresh');

            $('html, body').animate({
                scrollTop: $block.offset().top
            }, 450);

            if (prompt) {
                $block[options.blockType]('prompt');
            }

            return $block;
        },

        addComment : function(options) {

            if (options == undefined) {
                options = {};
            }

            if (options.id == undefined) {
                options.id = this.generateBlockID();
            }

            options.narrative = this;

            var $comment = $('<div></div>').comment(options);

            if (this.data('activeBlock')) {
                this.data('activeBlock').element.after($comment);
            }
            else {
                this.data('workspace').append($comment);
            }

            if (! options.noSave) {
                this.save();
            }

            return $comment;
        },

        activeBlock : function () {
            if (this.data('activeBlock')) {
                return this.data('activeBlock');
            }
            else {
                return this.data('workspace').children().last();
            }
        },

        blockActivateCallback : function ($block) {

            if (this.data('activeBlock') != undefined) {
                this.data('activeBlock').deactivate();
            }

            this.data('activeBlock', $block);

            //THIS IS A TEMPORARY HACK!
            $('#commandcontext').commandcontext('refresh');

        },

        blockDeactivateCallback : function ($block) {
            this.data('activeBlock', undefined);

            //THIS IS A TEMPORARY HACK!
            $('#commandcontext').commandcontext('refresh');
        },

        appendUI : function($elem) {

            var $container = $elem
                .append(
                    $('<div></div>')
                        .attr('id', 'workspace')
                        .droppable(
                            {
                                accept : 'li',
                                activeClass : 'ui-state-hover',
                                hoverClass : 'ui-state-highlight',
                                tolerance : 'touch',
                            }
                        )
                        .sortable(
                            {
                                cancel: ':input,button,.editor',
                                sort :
                                    $.proxy (
                                        function(event, ui) {
                                            this.reposition();
                                        },
                                        this
                                    ),
                                stop :
                                    $.proxy(
                                        function (evt, ui) {
                                            var node = ui.item.get(0).nodeName.toLowerCase();
                                            if(node != 'div') {
                                                var command = $('a', ui.item).attr('title');
                                                this.addBlock({name : command, target : ui.item});
                                            };
                                            this.reposition();
                                        },
                                        this
                                    )
                            }
                        )
                        .addClass('kb-nar-narrative')
                        .css('padding', '5px')
                );

            this._rewireIds($container, this);

            return $container;

        },

        reposition : function(evt) {
            $.each(
                this.data('workspace').children(),
                function (idx, val) {
                    var blockType = $(val).data('blockType');
                    $(val)[blockType]('reposition');
                }
            );
        },


    });

}( jQuery ) );
