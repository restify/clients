#
# Directories
#
ROOT_SLASH	:= $(dir $(realpath $(firstword $(MAKEFILE_LIST))))
ROOT		:= $(patsubst %/,%,$(ROOT_SLASH))
TEST		:= $(ROOT)/test
TOOLS		:= $(ROOT)/tools
GITHOOKS_SRC	:= $(TOOLS)/githooks
GITHOOKS_DEST	:= $(ROOT)/.git/hooks


#
# Generated Directories
#
NODE_MODULES	:= $(ROOT)/node_modules
NODE_BIN	:= $(NODE_MODULES)/.bin
COVERAGE	:= $(ROOT)/coverage


#
# Tools and binaries
#
YARN		:= yarn
ESLINT		:= $(NODE_BIN)/eslint
JSCS		:= $(NODE_BIN)/jscs
MOCHA		:= $(NODE_BIN)/mocha
_MOCHA		:= $(NODE_BIN)/_mocha
ISTANBUL	:= $(NODE_BIN)/istanbul
COVERALLS	:= $(NODE_BIN)/coveralls
UNLEASH		:= $(NODE_BIN)/unleash
CONVENTIONAL_RECOMMENDED_BUMP := $(NODE_BIN)/conventional-recommended-bump


#
# Files
#
LCOV		:= $(ROOT)/coverage/lcov.info
PACKAGE_JSON	:= $(ROOT)/package.json
YARN_LOCK       := $(ROOT)/yarn.lock
GITHOOKS	:= $(wildcard $(GITHOOKS_SRC)/*)
SHRINKWRAP	= $(ROOT)/npm-shrinkwrap.json
ALL_FILES	:= $(shell find $(ROOT) \
			-not \( -path $(NODE_MODULES) -prune \) \
			-not \( -path $(COVERAGE) -prune \) \
			-name '*.js' -type f)


#
# Targets
#


.PHONY: help
help:
	@perl -nle'print $& if m{^[a-zA-Z_-]+:.*?## .*$$}' $(MAKEFILE_LIST) \
		| sort | awk 'BEGIN {FS = ":.*?## "}; \
		{printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


.PHONY: all
all: $(NODE_MODULES) lint codestyle test clean-coverage


$(YARN_LOCK): $(PACKAGE_JSON)
	@$(YARN)


$(NODE_MODULES): $(PACKAGE_JSON)
	@$(YARN)
	@touch $(NODE_MODULES)


.PHONY: githooks
githooks: $(GITHOOKS) ## Install githooks
	@$(foreach hook,\
		$(GITHOOKS),\
			ln -sf $(hook) $(GITHOOKS_DEST)/$(hook##*/);\
	)


.PHONY: lint
lint: $(NODE_MODULES) ## Run lint checks
	@$(ESLINT) $(ALL_FILES)


.PHONY: codestyle
codestyle: $(NODE_MODULES) ## Run style checks
	@$(JSCS) $(ALL_FILES)


.PHONY: codestyle-fix
codestyle-fix: $(NODE_MODULES) ## Run and fix style check errors
	@$(JSCS) $(ALL_FILES) --fix


.PHONY: prepush
prepush: $(NODE_MODULES) lint codestyle test ## Run all required tasks for a git push


.PHONY: test
test: $(NODE_MODULES) ## Run unit tests
	@$(MOCHA) -R spec --full-trace


.PHONY: coverage
coverage: $(NODE_MODULES) clean-coverage ## Generate test coverage
	@$(ISTANBUL) cover $(_MOCHA) --report lcovonly -- -R spec


.PHONY: report-coverage
report-coverage: coverage ## Report test coverage to Coveralls
	@cat $(LCOV) | $(COVERALLS)


.PHONY: clean-coverage
clean-coverage:
	@rm -rf $(COVERAGE_FILES)


.PHONY: clean
clean: clean-coverage ## Clean all generated directories
	@rm -rf $(NODE_MODULES)


.PHONY: release-dry
release-dry: $(NODE_MODULES) $(UNLEASH) ## Dry run of `release` target
	$(UNLEASH) -d --type=$(shell $(CONVENTIONAL_RECOMMENDED_BUMP) -p angular)


.PHONY: release
release: $(NODE_MODULES) $(UNLEASH) ## Versions, tags, and updates changelog based on commit messages
	$(UNLEASH) --type=$(shell $(CONVENTIONAL_RECOMMENDED_BUMP) -p angular) --no-publish
	$(NPM) publish


#
## Debug -- print out a a variable via `make print-FOO`
#
print-%  : ; @echo $* = $($*)
