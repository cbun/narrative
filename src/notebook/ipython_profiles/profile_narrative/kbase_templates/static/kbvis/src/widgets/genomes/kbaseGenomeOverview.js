(function( $, undefined ) { 
    $.KBWidget({ 
        name: "KBaseGenomeOverview", 
        parent: "kbaseWidget", 
        version: "1.0.0",

        options: {
            genomeID: null,
            workspaceID: null,
            loadingImage: "../../widgets/images/ajax-loader.gif",
            isInCard: false,
        },

        cdmiURL: "https://kbase.us/services/cdmi_api",
        workspaceURL: "https://kbase.us/services/workspace",

        init: function(options) {
            this._super(options);
            if (this.options.genomeID === null) {
                //throw an error
                return;
            }

            this.$messagePane = $("<div/>")
                                .addClass("kbwidget-message-pane")
                                .addClass("kbwidget-hide-message");
            this.$elem.append(this.$messagePane);

            this.cdmiClient = new CDMI_API(this.cdmiURL);
            this.entityClient = new CDMI_EntityAPI(this.cdmiURL);
            this.workspaceClient = new workspaceService(this.workspaceURL);

            return this.render();
        },

        render: function(options) {
            this.showMessage("<img src='" + this.options.loadingImage + "'/>");

            /**
             * Fields to show:
             * ID
             * Workspace (if from a workspace)
             * Owner (KBase Central Store vs. username)
             * Scientific Name
             * Domain
             * Complete
             * Size in bp
             * GC content (do we need this?)
             * # contigs
             * # features
             * # genes - PEGs
             * # RNA feats
             * Taxonomy
             */

            var self = this;
            this.$elem.append($("<button />")
                              .addClass("btn btn-primary")
                              .append("Show Description")
                              .on("click", 
                                  function(event) {
                                      self.trigger("showGenomeDescription", 
                                          {
                                              genomeID: self.options.genomeID,
                                              workspaceID: self.options.workspaceID,
                                              event: event
                                          }
                                      );
                                    })
                              );
            this.entityClient.get_entity_Genome([this.options.genomeID],
                ['id', 'scientific_name', 'domain', 'complete', 'dna_size', 'source_id', 
                 'contigs', 'gc_content', 'pegs', 'rnas'],

                function(genome) {
                    genome = genome[self.options.genomeID];
                    self.genome = genome; // store it for now.

                    var $infoTable = $("<div />")  // should probably be styled somehow. Bootstrapish?
                                     .append($("<table/>")
                                             .addClass("table table-bordered table-striped")
                                             .append($("<tr/>")
                                                     .append("<td>ID</td><td>" + genome.id + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>Name</td><td>" + genome.scientific_name + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>Domain</td><td>" + genome.domain + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>Complete?</td><td>" + (genome.complete ? "Yes" : "No") + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>DNA Length</td><td>" + genome.dna_size + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>Source ID</td><td>" + genome.source_id + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>Number of Contigs</td><td>" + genome.contigs + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>GC Content</td><td>" + Number(genome.gc_content).toFixed(2) + " %" + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>Protein encoding genes</td><td>" + genome.pegs + "</td>")
                                                    )
                                             .append($("<tr/>")
                                                     .append("<td>RNAs</td><td>" + genome.rnas + "</td>")
                                                    )
                                     );
                    self.$elem.append($infoTable);

                    /*
                     * Here we go. Chain of callbacks.
                     * Get list of contigs, then get their lengths.
                     * Sort them by length and make a dropdown menu.
                     * Add a button that will open a new card with that contig's browser.
                     */
                    if (self.options.isInCard) {
                        self.cdmiClient.genomes_to_contigs([self.options.genomeID],
                            function(contigs) {
                                self.cdmiClient.contigs_to_lengths(contigs[self.options.genomeID],
                                    function(contigsToLengths) {
                                        var $dropdown = $("<select />");
                                        for (var contig in contigsToLengths) {
                                            $dropdown.append("<option id='" + contig + "'>" + contig + " - " + contigsToLengths[contig] + " bp</option>");
                                        }

                                        self.$elem.append($dropdown);
                                        self.$elem.append($("<button class='btn btn-primary'>Show Contig</button>")
                                                          .on("click", 
                                                              function(event) {
                                                                  $(self.$elem.selector + " > select option:selected").each(function() {
                                                                      self.trigger("showContig", { contig: $(this).attr("id"), event: event });
                                                                  })
                                                              })
                                        );
                                    },

                                    self.clientError
                                );
                            },

                            self.clientError
                        );
                    }

                },

                self.clientError
            );

            this.hideMessage();
            return this;
        },

        getData: function() {
            return {
                type: "Genome",
                id: this.options.genomeID,
                workspace: this.options.workspaceID,
                title: "Genome Overview"
            };
        },

        showMessage: function(message) {
            var span = $("<span/>").append(message);

            this.$messagePane.append(span);
            this.$messagePane.removeClass("kbwidget-hide-message");
        },

        hideMessage: function() {
            this.$messagePane.addClass("kbwidget-hide-message");
            this.$messagePane.empty();
        },

        clientError: function(error) {
        }

    });
})( jQuery );