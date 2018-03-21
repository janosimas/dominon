import { populateModule } from '../utils'

import festival from './cards/festival'
import village from './cards/village'
import laboratory from './cards/laboratory'
import smith from './cards/smith'
import woodcutter from './cards/woodcutter'
import militia from './cards/militia'
import cellar from './cards/cellar'
import workshop from './cards/workshop'

let mod = {
  cards: [],
  custom_phases: [],
  custom_moves: []
}

populateModule(mod, [ festival,
                         village,
                         laboratory,
                         smith,
                         woodcutter,
                         militia,
                         workshop,
                         cellar
                        ]);

export default mod;