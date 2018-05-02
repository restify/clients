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
MOCHA		:= $(NODE_BIN)/mocha
_MOCHA		:= $(NODE_BIN)/_mocha
ISTANBUL	:= $(NODE_BIN)/istanbul
COVERALLS	:= $(NODE_BIN)/coveralls
NSP		:= $(NODE_BIN)/nsp
JSON		:= $(NODE_BIN)/json


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


.PHONY: lint-fix
lint-fix: node_modules $(LIB_FILES) $(TEST_FILES)
	@$(ESLINT) $(LIB_FILES) $(TEST_FILES) --fix


.PHONY: nsp
nsp: $(NODE_MODULES) $(YARN_LOCK) ## Check for dependency vulnerabilities
	@$(NSP) check --preprocessor yarn


.PHONY: prepush
prepush: $(NODE_MODULES) lint test versioncheck ## Run all required tasks for a git push


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


# Ensure CHANGES.md and package.json have the same version after a
# "## not yet released" section intended for unreleased changes.
.PHONY: versioncheck
versioncheck: | node_modules
	@echo version is: $(shell cat package.json | $(JSON) version)
	[ `cat package.json | $(JSON) version` \
	    = `grep '^## ' CHANGES.md | head -2 | tail -1 | awk '{print $$2}'` ]

# Confirm, then tag and publish the current version.
.PHONY: cutarelease
cutarelease: versioncheck
	[ -z "`git status --short`" ]  # If this fails, the working dir is dirty.
	@ver=$(shell $(JSON) -f package.json version) && \
	    name=$(shell $(JSON) -f package.json name) && \
	    publishedVer=$(shell npm view -j $(shell $(JSON) -f package.json name)@$(shell $(JSON) -f package.json version) version 2>/dev/null) && \
	    if [ -n "$$publishedVer" ]; then \
		echo "error: $$name@$$ver is already published to npm"; \
		exit 1; \
	    fi && \
	    echo "** Are you sure you want to tag and publish $$name@$$ver to npm?" && \
	    echo "** Enter to continue, Ctrl+C to abort." && \
	    read _cutarelease_confirm
	ver=$(shell cat package.json | $(JSON) version) && \
	    date=$(shell date -u "+%Y-%m-%d") && \
	    git tag -a "v$$ver" -m "version $$ver ($$date)" && \
	    git push --tags origin && \
	    npm publish


#
## Debug -- print out a a variable via `make print-FOO`
#
print-%  : ; @echo $* = $($*)
