#
# Directories
#
ROOT           := $(shell pwd)
NODE_MODULES   := $(ROOT)/node_modules
NODE_BIN       := $(NODE_MODULES)/.bin
TOOLS          := $(ROOT)/tools


#
# Tools and binaries
#
ESLINT      := $(NODE_BIN)/eslint
JSCS        := $(NODE_BIN)/jscs
MOCHA       := $(NODE_BIN)/mocha
_MOCHA      := $(NODE_BIN)/_mocha
ISTANBUL    := $(NODE_BIN)/istanbul
COVERALLS   := $(NODE_BIN)/coveralls
NSP         := $(NODE_BIN)/nsp
NPM         := npm
NSP_BADGE   := $(TOOLS)/nspBadge.js


#
# Files
#
GIT_HOOK_SRC   = '../../tools/githooks/pre-push'
GIT_HOOK_DEST  = '.git/hooks/pre-push'
LIB_FILES  	   = $(ROOT)/lib
TEST_FILES     = $(ROOT)/test
COVERAGE_FILES = $(ROOT)/coverage
LCOV           = $(ROOT)/coverage/lcov.info
SHRINKWRAP     = $(ROOT)/npm-shrinkwrap.json


#
# Targets
#

.PHONY: all
all: node_modules lint codestyle test clean-coverage


node_modules: package.json
	$(NPM) install
	@touch $(NODE_MODULES)


.PHONY: githooks
githooks:
	@ln -s $(GIT_HOOK_SRC) $(GIT_HOOK_DEST)


.PHONY: lint
lint: node_modules $(LIB_FILES) $(TEST_FILES)
	$(ESLINT) $(LIB_FILES) $(TEST_FILES)


.PHONY: codestyle
codestyle: node_modules $(LIB_FILES) $(TEST_FILES)
	$(JSCS) $(LIB_FILES) $(TEST_FILES)


.PHONY: codestyle-fix
codestyle-fix: node_modules $(LIB_FILES) $(TEST_FILES)
	$(JSCS) $(LIB_FILES) $(TEST_FILES) --fix


.PHONY: nsp
nsp: node_modules $(NSP)
	$(NPM) shrinkwrap --dev
	($(NSP) audit-shrinkwrap || echo 1) | $(NSP_BADGE)
	@rm $(SHRINKWRAP)


.PHONY: prepush
prepush: node_modules lint codestyle test


.PHONY: test
test: node_modules
	$(MOCHA) -R spec


.PHONY: coverage
coverage: node_modules clean-coverage $(LIB_FILES) $(TEST_FILES)
	$(ISTANBUL) cover $(_MOCHA) --report lcovonly -- -R spec


.PHONY: report-coverage
report-coverage: coverage
	@cat $(LCOV) | $(COVERALLS)


.PHONY: clean-coverage
clean-coverage:
	@rm -rf $(COVERAGE_FILES)


.PHONY: clean
clean: clean-coverage
	@rm -rf $(NODE_MODULES)


#
## Debug -- print out a a variable via `make print-FOO`
#
print-%  : ; @echo $* = $($*)

