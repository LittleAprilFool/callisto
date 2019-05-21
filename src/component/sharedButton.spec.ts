import { SharedButton } from './sharedButton';
import { expect } from 'chai';
import 'mocha';

describe('SharedButton Class', () => {

  // can not run this unit test, problem with loading external packages
  it('should return share', () => {
    const foo = new SharedButton();
    expect(foo.button.label).to.equal('Share');
  });

});